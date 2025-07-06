export interface EventType {
    id: string;
    name: string;
    description: string;
    requiresParticipants: boolean;
    requiresLocation: boolean;
    requiresLink: boolean;
  }

  export interface Event {
    id: string;
    title: string;
    type: EventType;
    kind: 'event' | 'outing' | 'site-visit' | 'meeting' | 'workshop' | 'training';
    format: 'virtual' | 'in-person' | 'hybrid';
    date: string;
    time: Date;
    participants: Participant[];
    location?: string;
    link?: string;
    description?: string;
    createdAt: Date;
    companyCode: string;
  }

  export interface Participant {
    id: string;
    name: string;
    email: string;
    role: string;
    confirmed: boolean;
  }

  export const EVENT_TYPES: EventType[] = [
    {
      id: 'workshop',
      name: 'Workshop',
      description: 'Educational workshop or training session',
      requiresParticipants: true,
      requiresLocation: true,
      requiresLink: false
    },
    {
      id: 'meeting',
      name: 'Meeting',
      description: 'Business meeting or discussion',
      requiresParticipants: true,
      requiresLocation: false,
      requiresLink: false
    },
    {
      id: 'site-visit',
      name: 'Site Visit',
      description: 'On-site visit or inspection',
      requiresParticipants: true,
      requiresLocation: true,
      requiresLink: false
    },
    {
      id: 'networking',
      name: 'Networking Event',
      description: 'Networking and relationship building event',
      requiresParticipants: true,
      requiresLocation: true,
      requiresLink: false
    },
    {
      id: 'webinar',
      name: 'Webinar',
      description: 'Online presentation or seminar',
      requiresParticipants: true,
      requiresLocation: false,
      requiresLink: true
    }
  ];

  export const EVENT_KINDS = [
    { value: 'event', label: 'General Event' },
    { value: 'outing', label: 'Team Outing' },
    { value: 'site-visit', label: 'Site Visit' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'training', label: 'Training Session' }
  ];

  export const EVENT_FORMATS = [
    { value: 'virtual', label: 'Virtual' },
    { value: 'in-person', label: 'In-Person' },
    { value: 'hybrid', label: 'Hybrid' }
  ];
