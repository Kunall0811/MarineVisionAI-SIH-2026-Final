# Historical reference data provenance

MarineVision AI now stores documented historical reference points in MongoDB (`historical_references`) and renders them on the Cesium globe.

These records are **not AI detections**, **not synthetic sonar observations**, and **not a claim that the object was detected by this application**. They are reference coordinates taken from public NOAA records so judges can navigate to real historical maritime incidents.

Included examples:
- RMS Titanic expedition reference (NOAA NCEI, 2004 expedition metadata)
- Atlas wreck (NOAA Monitor National Marine Sanctuary)
- M/V Manoa lost containers (NOAA IncidentNews, 2015)
- ONE Apus container-loss incident (NOAA IncidentNews, 2020)
- M/V Maersk Essen container-loss incident (NOAA IncidentNews, 2021)
- Washington Coast container-loss incident (NOAA IncidentNews, 2021)
- M/V President Eisenhower lost containers (NOAA IncidentNews, 2024)
- C/V S.M. Portland lost containers (NOAA IncidentNews, 2025)
- Fort Funston marine debris observation (NOAA IncidentNews, 2021)

Run:

```bash
npm run seed:historical
```

The seed is idempotent (`sourceId` is unique).

Important: Incident coordinates supplied by NOAA are often approximate. The UI therefore displays coordinate accuracy and retains the source URL. The 184°01.20′ W longitude in the 2025 S.M. Portland record is normalized to +175.98° E for GeoJSON/Cesium.
