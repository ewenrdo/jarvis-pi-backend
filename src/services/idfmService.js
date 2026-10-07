function createIDFMService({ apiKey }) {

    const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

    // Coordonnées GPS (lon,lat)
    const DEPARTURE_LOCATION = '2.2796409130096436;48.975181579589844';
    const FACULTY_LOCATION = '2.3794524669647217,48.8297004699707';

    // Cache en mémoire
    const cache = {
        trains: new Map(),
        disruptions: null
    };

    // Permet d'éviter plusieurs requêtes simultanées pour le même arrêt.
    const pendingTrainRequests = new Map();


    /**
     * Formate une date JS locale au format attendu par Navitia : YYYYMMDDTHHMMSS
     */
    function formatNavitiaDateTime(date) {
        const pad = (num) => String(num).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    }

    /**
     * Convertit la chaîne YYYYMMDDTHHMMSS de Navitia en objet Date JS
     */
    function parseNavitiaDateTime(str) {
        if (!str || str.length < 15) return new Date();
        const year = str.slice(0, 4);
        const month = str.slice(4, 6) - 1;
        const day = str.slice(6, 8);
        const hours = str.slice(9, 11);
        const minutes = str.slice(11, 13);
        const seconds = str.slice(13, 15);

        return new Date(year, month, day, hours, minutes, seconds);
    }

    /**
     * Helper temporaire pour les icônes de transport
     */
    function getTransportIcon(identifier) {
        return identifier || '🚆';
    }

    /**
     * Récupère les 2 meilleurs itinéraires (Principal + Secours) vers la fac sans bus.
     * 
     * @param {Date|string} targetArrivalTime Heure d'arrivée souhaitée (par défaut : maintenant)
     */
    async function getFacultyJourneys(targetArrivalTime = new Date()) {
        const arrivalDate = targetArrivalTime instanceof Date
            ? targetArrivalTime
            : new Date(targetArrivalTime);

        const formattedDateTime = formatNavitiaDateTime(arrivalDate);

        // URL de base de l'API PRIM / IDFM Navitia
        const url = new URL('https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia/journeys');

        url.searchParams.append('from', DEPARTURE_LOCATION);
        url.searchParams.append('to', FACULTY_LOCATION);
        url.searchParams.append('datetime', formattedDateTime);
        url.searchParams.append('datetime_represents', 'arrival');
        url.searchParams.append('forbidden_uris[]', 'physical_mode:Bus');
        url.searchParams.append('first_section_mode[]', 'walking');
        url.searchParams.append('last_section_mode[]', 'walking');
        url.searchParams.append('data_freshness', 'realtime');
        url.searchParams.append('count', '2');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'apiKey': apiKey
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erreur HTTP ${response.status} (${response.statusText}) : ${errorText}`);
        }

        const data = await response.json();
        const journeys = data.journeys || [];

        const parsedJourneys = journeys.map((journey, index) => {
            const departureTime = parseNavitiaDateTime(journey.departure_date_time);
            const arrivalTime = parseNavitiaDateTime(journey.arrival_date_time);

            const now = new Date();
            const minutesBeforeDeparture = Math.round((departureTime - now) / 60000);

            const steps = (journey.sections || [])
                .filter(sec => sec.type === 'public_transport')
                .map(sec => ({
                    mode: sec.display_informations?.commercial_mode || 'Transport',
                    line: sec.display_informations?.code || '',
                    shortLine: getTransportIcon(sec.display_informations?.network || sec.display_informations?.code),
                    from: sec.from?.name || '',
                    to: sec.to?.name || '',
                    direction: sec.display_informations?.direction || ''
                }));

            return {
                type: index === 0 ? 'principal' : 'secours',
                minutesBeforeDeparture,
                departureTime: departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                arrivalTime: arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                durationMinutes: Math.round(journey.duration / 60),
                transfers: journey.nb_transfers,
                steps
            };
        });

        return {
            primary: parsedJourneys[0] || null,
            backup: parsedJourneys[1] || null
        };
    }

    async function nextTrainsFromStation(idfmStopId) {

        const now = new Date();

        const cached = cache.trains.get(idfmStopId);

        if (
            cached &&
            Date.now() - cached.timestamp < CACHE_DURATION
        ) {
            return filterUpcomingTrains(cached.data);
        }


        const currentHour = now.getHours();

        // Pas de requête API entre minuit et 5h du matin (pas de service, économie d'API)
        if (currentHour >= 0 && currentHour < 5) {

            // Si on a un ancien cache, on peut quand même l'utiliser
            if (cached) {
                return filterUpcomingTrains(cached.data);
            }

            // Pas de cache -> aucune requête PRIM
            return [];
        }


        const pendingRequest = pendingTrainRequests.get(idfmStopId);

        if (pendingRequest) {
            const departures = await pendingRequest;

            return filterUpcomingTrains(departures);
        }

        const request = fetch(
            `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${idfmStopId}`,
            {
                headers: {
                    accept: 'application/json',
                    apikey: apiKey
                }
            }
        )
            .then(async response => {

                if (!response.ok) {
                    throw new Error(
                        `Erreur lors de la récupération des prochains trains : ${response.statusText}`
                    );
                }

                const data = await response.json();

                const stopVisits =
                    data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]
                        ?.MonitoredStopVisit || [];

                const departures = stopVisits.map((visit) => {

                    const journey = visit.MonitoredVehicleJourney;
                    const call = journey.MonitoredCall;

                    const aimedDeparture =
                        new Date(call.AimedDepartureTime);

                    const expectedDeparture =
                        call.ExpectedDepartureTime
                            ? new Date(call.ExpectedDepartureTime)
                            : null;

                    // Pour déterminer si le train est passé,
                    // on utilise l'heure réelle/prévue si disponible.
                    const departureTime =
                        expectedDeparture || aimedDeparture;

                    let delayMinutes = 0;

                    if (
                        expectedDeparture &&
                        call.DepartureStatus === 'delayed'
                    ) {
                        delayMinutes = Math.round(
                            (expectedDeparture - aimedDeparture) / 60000
                        );
                    }

                    return {
                        id: visit.ItemIdentifier,
                        line: journey.LineRef?.value || '',
                        shortLine: getTransportIcon(
                            journey.LineRef?.value || ''
                        ),
                        journeyNote:
                            journey.JourneyNote?.[0]?.value || '',

                        destination:
                            call.DestinationDisplay?.[0]?.value ||
                            journey.DestinationName?.[0]?.value ||
                            'Inconnue',

                        aimedTime:
                            aimedDeparture.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            }),

                        expectedTime:
                            expectedDeparture
                                ? expectedDeparture.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })
                                : null,

                        status: call.DepartureStatus,
                        delay: delayMinutes,

                        // Utilisé uniquement en interne
                        departureTimestamp: departureTime.getTime()
                    };
                });

                // Stocker dans le cache
                cache.trains.set(idfmStopId, {
                    timestamp: Date.now(),
                    data: departures
                });

                return departures;
            })
            .finally(() => {
                pendingTrainRequests.delete(idfmStopId);
            });


        pendingTrainRequests.set(idfmStopId, request);


        const departures = await request;

        return filterUpcomingTrains(departures);
    }


    function filterUpcomingTrains(departures) {

        const now = Date.now() + 14 * 60 * 1000; // Ajouter 14 minutes pour le temps d'aller à la gare

        return departures
            .filter(train => train.departureTimestamp > now)
            .map(train => {

                // Ne pas exposer departureTimestamp
                const {
                    departureTimestamp,
                    ...departure
                } = train;

                return departure;
            });
    }


    function getTransportIcon(line) {
        if (line == 'STIF:Line::C01739:') return 'J';
        else if (line == 'STIF:Line::C01727:') return 'C';
        else if (line == 'STIF:Line::C01737:') return 'H';
        else return line;
    }


    async function getDisruptions() {

        if (
            cache.disruptions &&
            Date.now() - cache.disruptions.timestamp < CACHE_DURATION
        ) {
            return cache.disruptions.data;
        }


        const currentHour = new Date().getHours();

        if (currentHour >= 0 && currentHour < 5) {

            // Retourner éventuellement l'ancien cache
            if (cache.disruptions) {
                return cache.disruptions.data;
            }

            return [];
        }


        const response = await fetch(
            `https://prim.iledefrance-mobilites.fr/marketplace/disruptions_bulk/disruptions/v2`,
            {
                headers: {
                    'apikey': apiKey,
                    'accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                `Erreur lors de la récupération des perturbations : ${response.statusText}`
            );
        }

        const data = await response.json();
        const now = new Date();

        function parseIdfmDate(dateStr) {

            const year = parseInt(
                dateStr.substring(0, 4),
                10
            );

            const month = parseInt(
                dateStr.substring(4, 6),
                10
            ) - 1;

            const day = parseInt(
                dateStr.substring(6, 8),
                10
            );

            const hour = parseInt(
                dateStr.substring(9, 11),
                10
            );

            const minute = parseInt(
                dateStr.substring(11, 13),
                10
            );

            const second = parseInt(
                dateStr.substring(13, 15),
                10
            );

            return new Date(
                Date.UTC(
                    year,
                    month,
                    day,
                    hour,
                    minute,
                    second
                )
            );
        }


        // 1. Filtrer les lignes d'intérêt
        const filteredLines = data.lines.filter(
            line => ['C', 'H', 'J'].includes(line.shortName)
        );


        // 2. Transformer les données
        const result = filteredLines.map(line => {

            const htmlMessages = [];

            line.impactedObjects.forEach(obj => {

                if (
                    obj.name === line.shortName ||
                    obj.name.includes("Ermont")
                ) {

                    const disruptionIds =
                        obj.disruptionIds || [];

                    disruptionIds.forEach(id => {

                        const disruption =
                            data.disruptions.find(
                                d => d.id === id
                            );

                        if (disruption) {

                            const isActive =
                                disruption.applicationPeriods.some(
                                    period => {

                                        const beginDate =
                                            parseIdfmDate(
                                                period.begin
                                            );

                                        const endDate =
                                            parseIdfmDate(
                                                period.end
                                            );

                                        return (
                                            now >= beginDate &&
                                            now <= endDate
                                        );
                                    }
                                );

                            if (
                                isActive &&
                                disruption.message
                            ) {
                                htmlMessages.push(
                                    disruption.message
                                );
                            }
                        }
                    });
                }
            });

            return {
                lineName: line.shortName,
                type: line.mode,
                htmlMessages: [
                    ...new Set(htmlMessages)
                ]
            };
        });

        // Ne garder que les lignes ayant des perturbations
        const finalResult = result.filter(
            item => item.htmlMessages.length > 0
        );

        cache.disruptions = {
            timestamp: Date.now(),
            data: finalResult
        };

        return finalResult;
    }


    return {
        getDisruptions,
        nextTrainsFromStation,
        getFacultyJourneys
    };
}

module.exports = {
    createIDFMService
};