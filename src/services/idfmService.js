function createIDFMService({ apiKey }) {

    const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

    // Cache en mémoire pour ne pas saturer la limite d'appels à l'API IDFM PRIM
    const cache = {
        trains: new Map(),
        disruptions: null
    };


    async function nextTrainsFromStation(idfmStopId) {

        const now = new Date();

        // Vérifier le cache
        const cached = cache.trains.get(idfmStopId);

        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {

            return cached.data.filter(train => {
                return train.departureTimestamp > now.getTime();
            }).map(train => {
                const { departureTimestamp, ...departure } = train;
                return departure;
            });
        }

        // Si pas de cache valide -> appel API
        const response = await fetch(
            `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${idfmStopId}`,
            {
                headers: {
                    accept: 'application/json',
                    apikey: apiKey
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                `Erreur lors de la récupération des prochains trains : ${response.statusText}`
            );
        }

        const data = await response.json();

        const stopVisits =
            data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]
                ?.MonitoredStopVisit || [];

        const departures = stopVisits
            .map((visit) => {
                const journey = visit.MonitoredVehicleJourney;
                const call = journey.MonitoredCall;

                const aimedDeparture = new Date(call.AimedDepartureTime);

                const expectedDeparture = call.ExpectedDepartureTime
                    ? new Date(call.ExpectedDepartureTime)
                    : null;

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
                    shortLine: getTransportIcon(journey.LineRef?.value || ''),
                    journeyNote: journey.JourneyNote?.[0]?.value || '',
                    destination:
                        call.DestinationDisplay?.[0]?.value ||
                        journey.DestinationName?.[0]?.value ||
                        'Inconnue',

                    aimedTime: aimedDeparture.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    }),

                    expectedTime: expectedDeparture
                        ? expectedDeparture.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                        : null,

                    status: call.DepartureStatus,
                    delay: delayMinutes,

                    // Utilisé uniquement en interne pour le filtrage du cache
                    departureTimestamp: aimedDeparture.getTime()
                };
            })
            // Ne garder que les trains qui ne sont pas encore partis
            .filter(train => train.departureTimestamp > now.getTime());

        // Stocker dans le cache
        cache.trains.set(idfmStopId, {
            timestamp: Date.now(),
            data: departures
        });

        // Retirer departureTimestamp du résultat public
        return departures.map(train => {
            const { departureTimestamp, ...departure } = train;
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

        // Vérifier le cache
        if (
            cache.disruptions &&
            Date.now() - cache.disruptions.timestamp < CACHE_DURATION
        ) {
            return cache.disruptions.data;
        }

        // Pas de cache valide -> appel API
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
            const year = parseInt(dateStr.substring(0, 4), 10);
            const month = parseInt(dateStr.substring(4, 6), 10) - 1;
            const day = parseInt(dateStr.substring(6, 8), 10);
            const hour = parseInt(dateStr.substring(9, 11), 10);
            const minute = parseInt(dateStr.substring(11, 13), 10);
            const second = parseInt(dateStr.substring(13, 15), 10);

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

        const filteredLines = data.lines.filter(
            line => ['C', 'H', 'J'].includes(line.shortName)
        );

        const result = filteredLines.map(line => {
            const htmlMessages = [];

            line.impactedObjects.forEach(obj => {

                if (
                    obj.name === line.shortName ||
                    obj.name.includes("Ermont")
                ) {
                    const disruptionIds = obj.disruptionIds || [];

                    disruptionIds.forEach(id => {

                        const disruption =
                            data.disruptions.find(d => d.id === id);

                        if (disruption) {

                            const isActive =
                                disruption.applicationPeriods.some(period => {

                                    const beginDate =
                                        parseIdfmDate(period.begin);

                                    const endDate =
                                        parseIdfmDate(period.end);

                                    return (
                                        now >= beginDate &&
                                        now <= endDate
                                    );
                                });

                            if (isActive && disruption.message) {
                                htmlMessages.push(disruption.message);
                            }
                        }
                    });
                }
            });

            return {
                lineName: line.shortName,
                type: line.mode,
                htmlMessages: [...new Set(htmlMessages)]
            };
        });

        const finalResult = result.filter(
            item => item.htmlMessages.length > 0
        );

        // Stocker dans le cache
        cache.disruptions = {
            timestamp: Date.now(),
            data: finalResult
        };

        return finalResult;
    }


    return {
        getDisruptions,
        nextTrainsFromStation
    };
}

module.exports = {
    createIDFMService
};
