# Judge demo flow

1. Start MongoDB and Redis.
2. Start backend and frontend.
3. Seed the historical reference layer:
   `cd backend && npm run seed:historical`
4. Login with the existing demo account shown in the README.
5. Open **Globe**.
6. Use **Historical layer** to select:
   - Shipwrecks
   - Lost containers
   - Marine debris
7. Click a record in **Historical Ocean Evidence** to fly the Cesium globe to the documented coordinates.
8. The panel shows year, type, quantity (when reported), coordinates and provenance.
9. Explain to judges: these are documented historical references, not fake detections and not claimed sonar observations.
10. For AI detection, upload a real sonar frame. If a validated ONNX model is not installed, the UI explicitly reports that the neural model is unavailable.
