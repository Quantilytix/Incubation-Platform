// src/components/GeoChallengeMap.tsx
import React, { useEffect, useState } from 'react'
import Highcharts from 'highcharts'
import HighchartsMap from 'highcharts/modules/map'
import HighchartsReact from 'highcharts-react-official'
import zaMap from '../../../public/maps/za-all.geo.json' // Ensure the path is correct

HighchartsMap(Highcharts)

const dummyData = [
  { code: 'ZA-GT', name: 'Gauteng', value: 12 },
  { code: 'ZA-NL', name: 'KwaZulu-Natal', value: 9 },
  { code: 'ZA-WC', name: 'Western Cape', value: 6 },
  { code: 'ZA-EC', name: 'Eastern Cape', value: 4 },
  { code: 'ZA-FS', name: 'Free State', value: 3 },
  { code: 'ZA-NW', name: 'North West', value: 2 },
  { code: 'ZA-MP', name: 'Mpumalanga', value: 5 },
  { code: 'ZA-LP', name: 'Limpopo', value: 7 },
  { code: 'ZA-NC', name: 'Northern Cape', value: 1 }
]

const GeoChallengeMap = () => {
  const [options, setOptions] = useState({})

  useEffect(() => {
    const mapOptions: Highcharts.Options = {
      chart: {
        map: zaMap as any,
        height: 500
      },
      title: {
        text: '🔥 Challenges by Province'
      },
      colorAxis: {
        min: 0,
        stops: [
          [0, '#e0f3f8'],
          [0.5, '#abd9e9'],
          [0.9, '#2c7fb8']
        ]
      },
      tooltip: {
        pointFormat: '{point.name}: <b>{point.value}</b> challenges'
      },
      series: [
        {
          type: 'map',
          name: 'Challenges',
          data: dummyData.map(p => [p.code, p.value]),
          mapData: zaMap as any,
          joinBy: 'hc-key',
          dataLabels: {
            enabled: true,
            format: '{point.name}'
          }
        }
      ]
    }

    setOptions(mapOptions)
  }, [])

  return (
    <HighchartsReact
      constructorType='mapChart'
      highcharts={Highcharts}
      options={options}
    />
  )
}

export default GeoChallengeMap
