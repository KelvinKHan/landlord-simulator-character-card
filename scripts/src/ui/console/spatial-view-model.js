export function compileOwnedSpatialTargets(portfolio, currentBuildingId) {
  return Object.freeze((portfolio?.owned ?? []).flatMap(building => building.floors.flatMap(floor => floor.spaces.map(space => Object.freeze({
    ...space,
    buildingId: building.id,
    buildingName: building.name,
    floorName: floor.name,
    currentBuilding: building.id === currentBuildingId,
  })))));
}
