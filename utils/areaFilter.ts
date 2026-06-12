export function inArea(lat: number, lng: number, area: any) {
  return (
    lat >= area.minLat &&
    lat <= area.maxLat &&
    lng >= area.minLng &&
    lng <= area.maxLng
  );
}
