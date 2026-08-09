function createIDFMService({ apiKey }) {

    async function nextTrainsFromStation(idfmStopId) {
        
        const response = await fetch(`https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${idfmStopId}`, {
          headers: {
            accept: 'application/json',
            apikey: apiKey
          }
        });

        if (!response.ok) {
            throw new Error(`Erreur lors de la récupération des prochains trains : ${response.statusText}`);
        }

        const data = await response.json();
        const stopVisits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

        const departures = stopVisits.map((visit) => {
          const journey = visit.MonitoredVehicleJourney;
          const call = journey.MonitoredCall;
          const aimedDeparture = new Date(call.AimedDepartureTime);
          const expectedDeparture = call.ExpectedDepartureTime ? new Date(call.ExpectedDepartureTime) : null;

          let delayMinutes = 0;
          if (expectedDeparture && call.DepartureStatus === 'delayed') {
            delayMinutes = Math.round((expectedDeparture - aimedDeparture) / 60000);
          }

          return {
            id: visit.ItemIdentifier,
            line: journey.LineRef?.value || '',
            modeIcon: getTransportIcon(journey.LineRef?.value || ''),
            destination: call.DestinationDisplay?.[0]?.value || journey.DestinationName?.[0]?.value || 'Inconnue',
            aimedTime: aimedDeparture.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            expectedTime: expectedDeparture ? expectedDeparture.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
            status: call.DepartureStatus,
            delay: delayMinutes
          };
        });
        return departures;
    }

    async function getDisruptions() {
        const response = await fetch(`https://prim.iledefrance-mobilites.fr/marketplace/disruptions_bulk/disruptions/v2`, {
            headers: {
                'apikey': apiKey,
                'accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur lors de la récupération des perturbations : ${response.statusText}`);
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
            return new Date(Date.UTC(year, month, day, hour, minute, second));
        }

        // 1. Filtrer les lignes d'intérêt (C, H, J) basées sur shortName
        const filteredLines = data.lines.filter(line => ['C', 'H', 'J'].includes(line.shortName));

        // 2. Transformer pour obtenir le format propre demandé
        const result = filteredLines.map(line => {
            const htmlMessages = [];

            line.impactedObjects.forEach(obj => {
                // On vérifie si l'objet correspond à la ligne ou à Ermont
                if (obj.name === line.shortName || obj.name.includes("Ermont")) {
                    const disruptionIds = obj.disruptionIds || [];

                    disruptionIds.forEach(id => {
                        const disruption = data.disruptions.find(d => d.id === id);
                        if (disruption) {
                            // Vérifier si la perturbation est active
                            const isActive = disruption.applicationPeriods.some(period => {
                                const beginDate = parseIdfmDate(period.begin);
                                const endDate = parseIdfmDate(period.end);
                                return now >= beginDate && now <= endDate;
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
                htmlMessages: [...new Set(htmlMessages)] // Évite les doublons de messages s'il y en a plusieurs
            };
        });

        // Ne garder que les lignes qui ont effectivement des messages de perturbation actifs
        return result.filter(item => item.htmlMessages.length > 0);
    }

    return {
        getDisruptions,
        nextTrainsFromStation
    };
}

module.exports = {
    createIDFMService
};