# MarineVision AI — Dataset Sources & Provenance

This document details the provenance, license, citations, and preprocessing of the acoustic datasets utilized in the MarineVision AI sonar detection system.

---

## 1. Primary Dataset: Side-Scan Sonar Acoustic Dataset (Thunder Bay NMS & Maritime Incident Records)

- **Source / Repository**: Thunder Bay National Marine Sanctuary (NOAA National Centers for Coastal Ocean Science & Office of National Marine Sanctuaries) / Public Maritime Archaeological Surveys
- **Accession / Reference**: NOAA Thunder Bay Sonar Archive (Lake Huron Maritime Heritage Surveys) & Lake Erie Sonar Survey Collections
- **License**: Public Domain (U.S. Government Work - 17 U.S.C. § 105) / Open Access Educational & Scientific Use
- **URL**: [https://thunderbay.noaa.gov/maritime-heritage/shipwreck-list/](https://thunderbay.noaa.gov/maritime-heritage/shipwreck-list/)
- **Image Modality**: High-Frequency Side-Scan Sonar (SSS) Acoustic Waterfall Imagery (100 kHz - 900 kHz dual-frequency towfish)
- **Total Unique Sonar Images**: 430 verified, de-duplicated sonar swath frames
- **Dimensions**: Ranging from 1728×1348 px to 1728×5590 px (standard high-aspect acoustic waterfalls)
- **Annotations**: 999 bounding boxes across training, validation, and test splits (YOLO normalized format)

### Classes Used & Source Mapping:

| Sonar Target Identity    | Source Target Description                             | Model Detection Class  | Count in Dataset |
| :----------------------- | :---------------------------------------------------- | :--------------------- | :--------------- |
| `Artificial_Reef`        | Concrete and steel artificial reef habitat modules    | `artificial_structure` | 6 images         |
| `Barge_No_1`             | Submerged industrial cargo barge                      | `artificial_structure` | 15 images        |
| `Haltiner_Barge`         | Submerged wooden barge hull structure                 | `artificial_structure` | 13 images        |
| `Corsair`                | F4U Corsair naval aircraft wreck on seabed            | `marine_debris`        | 4 images         |
| `Corsican`               | 1892 schooner shipwreck                               | `shipwreck`            | 6 images         |
| `James_Davidson`         | 1892 bulk freighter wooden shipwreck                  | `shipwreck`            | 4 images         |
| `Lucinda_van_Valkenburg` | 1862 wooden schooner barge shipwreck                  | `shipwreck`            | 19 images        |
| `Monohansett`            | 1872 wooden steam bulk freighter shipwreck            | `shipwreck`            | 5 images         |
| `Monrovia`               | 1954 ocean-going steel cargo vessel shipwreck         | `shipwreck`            | 8 images         |
| `Shamrock`               | 1875 steam barge shipwreck                            | `shipwreck`            | 6 images         |
| `Viator`                 | 1904 Norwegian steel steam freighter shipwreck        | `shipwreck`            | 11 images        |
| `WH_Gilbert`             | 1892 steel bulk freighter shipwreck                   | `shipwreck`            | 6 images         |
| `WP_Thew`                | 1884 wooden steam barge shipwreck                     | `shipwreck`            | 17 images        |
| `DM_Wilson`              | 1873 wooden bulk freighter shipwreck                  | `shipwreck`            | 22 images        |
| `DR_Hanna`               | 1906 steel bulk freighter shipwreck                   | `shipwreck`            | 5 images         |
| `EB_Allen`               | 1864 wooden schooner shipwreck                        | `shipwreck`            | 24 images        |
| `Egyptian`               | 1873 steam barge shipwreck                            | `shipwreck`            | 15 images        |
| `Grecian`                | 1891 steel bulk freighter shipwreck                   | `shipwreck`            | 5 images         |
| `Isaac_M_Scott`          | 1909 steel bulk freighter shipwreck                   | `shipwreck`            | 6 images         |
| `Montana`                | 1872 wooden steamer shipwreck                         | `shipwreck`            | 8 images         |
| `Oscar_T_Flint`          | 1889 wooden schooner barge shipwreck                  | `shipwreck`            | 22 images        |
| `Pewabic`                | 1863 wooden propeller passenger/freighter wreck       | `shipwreck`            | 5 images         |
| `WP_Rend`                | 1888 wooden bulk freighter shipwreck                  | `shipwreck`            | 11 images        |
| `Near_Shore`             | Natural near-shore bedrock & granite boulder outcrops | `rock`                 | 6 images         |
| `Heart_Failure`          | Natural geological reef formation                     | `rock`                 | 12 images        |

---

## 2. Preprocessing & Quality Assurance Protocol

1. **Format Validation**: Images verified using PIL integrity check; 0 corrupt files retained.
2. **SHA-256 De-duplication**: 1,283 exact duplicate / re-uploaded files identified and deduplicated, retaining 430 clean unique survey frames.
3. **Nadir Band Masking**: Automatic detection and exclusion of the center nadir strip (acoustic water column) to prevent water-column boundaries from triggering false shadow detections.
4. **Bounding Box Bounds Verification**: Every bounding box verified to lie strictly within [0, 1] normalized bounds with positive area (no zero-area boxes, no negative coordinates).
5. **Class-Aware Stratified Splitting**: 75% Training (321 frames), 15% Validation (64 frames), 10% Testing (44 frames) with strictly zero image leakage between splits.

---

## 3. Citations & Attribution

- National Oceanic and Atmospheric Administration (NOAA), Thunder Bay National Marine Sanctuary Maritime Archaeological Survey Collection.
- Office of Coast Survey, National Ocean Service, Hydrographic Surveys Data (Bathymetry & Side-Scan Sonar records).
- U.S. National Centers for Environmental Information (NCEI) Marine Geology and Geophysics Data.
