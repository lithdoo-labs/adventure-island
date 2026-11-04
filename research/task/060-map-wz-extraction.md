# Task 060 — Map.wz Extraction: The Final Obstacle

## 0. Mission
Extract complete map data from server-side XML WZ files:
1. **Phase A**: Map inventory (all map IDs, names, categories)
2. **Phase B**: Map geometry (dimensions, footholds, boundaries)
3. **Phase C**: Map entities (portals, spawn points, NPCs, mob spawns)
4. **Phase D**: Map linking (portal → destination map graph)

## 1. Success Criteria
- ≥1000 map definitions extracted
- ≥5000 portal definitions with destinations
- Map graph (which map connects to which) constructed
- Cross-referenced with WARP_TO_MAP/CHANGE_MAP protocol
