/**
 * Google Maps のカスタムスタイル。
 * 夜の藍墨をベースに、温かみのあるトーンへ寄せた「ことづて」専用スタイル。
 * 情報量を抑えてピンと現在地が主役になるよう調整している。
 */
export const KOTOZUTE_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#232b38' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa0ab' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1e2530' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2c3543' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#3a4150' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7d8492' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#1a212c' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#27303d' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#3a4150' }],
  },
]
