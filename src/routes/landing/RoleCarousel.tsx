// src/components/RoleCarousel.tsx
import React, { useRef } from 'react'
import { Carousel, Button } from 'antd'
import type { CarouselRef } from 'antd/es/carousel'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import RoleCard from './RoleCard'

type RoleKey = 'sme' | 'incubate' | 'government' | 'investor'

interface Feature {
  icon: 'rocket' | 'users' | 'chart' | 'trending' | 'userplus'
  text: string
  desc: string
}

interface CardData {
  key: RoleKey
  title: string
  highlight: string
  features: Feature[]
}

const cardData: CardData[] = [
  {
    key: 'sme',
    title: 'Startup | SMME | Cooperative',
    highlight: 'Are you an SME looking for incubation programs?',
    features: [
      {
        icon: 'rocket',
        text: 'AI-matched funding opportunities',
        desc: 'Smart algorithms match your needs with suitable funders.'
      },
      {
        icon: 'users',
        text: 'Smart mentorship scheduling',
        desc: 'Book and manage mentor sessions efficiently.'
      },
      {
        icon: 'chart',
        text: 'Real-time performance insights',
        desc: 'Visualize progress and key performance indicators.'
      }
    ]
  },
  {
    key: 'incubate',
    title: 'Incubation | ESD Program Implementor',
    highlight: 'Accelerate your incubation impact with AI-driven tools.',
    features: [
      {
        icon: 'chart',
        text: 'Automated progress tracking',
        desc: 'Monitor incubatee performance with zero overhead.'
      },
      {
        icon: 'userplus',
        text: 'AI-based mentee matching',
        desc: 'Get intelligent mentee/mentor recommendations.'
      },
      {
        icon: 'rocket',
        text: 'Program analytics dashboard',
        desc: 'View and export aggregated analytics.'
      }
    ]
  },
  {
    key: 'government',
    title: 'Public Sector | International Entity',
    highlight: 'Leverage data to guide policy and support incubators.',
    features: [
      {
        icon: 'rocket',
        text: 'AI-informed impact reports',
        desc: 'Data-driven summaries for transparency and impact.'
      },
      {
        icon: 'users',
        text: 'Policy planning support tools',
        desc: 'Insights for shaping regional innovation policy.'
      },
      {
        icon: 'userplus',
        text: 'Stakeholder collaboration mapping',
        desc: 'Understand your ecosystem and partners.'
      }
    ]
  },
  {
    key: 'investor',
    title: 'Investor | Funder | Capital Partner',
    highlight: 'Connect with high-potential ventures and incubators.',
    features: [
      {
        icon: 'chart',
        text: 'Access curated incubatee pipelines',
        desc: 'Only verified and matched profiles are shown.'
      },
      {
        icon: 'rocket',
        text: 'Portfolio performance tracking',
        desc: 'Follow your impact and metrics in one view.'
      },
      {
        icon: 'userplus',
        text: 'Co-investment & impact analytics',
        desc: 'Leverage insights for smarter funding decisions.'
      }
    ]
  }
]

export default function RoleCarousel ({
  cardMax = 1040,
  wrapMax = cardMax + 120
}: {
  cardMax?: number
  wrapMax?: number
}) {
  const carouselRef = useRef<CarouselRef>(null)

  return (
    <div
      style={{
        width: '100%',
        maxWidth: wrapMax,
        margin: '0 auto',
        position: 'relative'
      }}
    >
      <Carousel
        ref={carouselRef}
        autoplay
        autoplaySpeed={5000}
        dots
        dotPosition='bottom'
        draggable
        adaptiveHeight
        pauseOnHover
        style={{ width: '100%' }}
      >
        {cardData.map(card => (
          <div key={card.key}>
            <div
              style={{
                padding: '16px 0',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              {/* Pass maxWidth so the card never exceeds the slide */}
              <RoleCard
                title={card.title}
                highlight={card.highlight}
                type={card.key}
                features={card.features}
                maxWidth={cardMax}
              />
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  )
}
