import React, { useState } from 'react';
import { Calendar, Badge, Modal, Button, Typography } from 'antd';
import type { CalendarMode } from 'antd/es/calendar/generateCalendar';
import type { Moment } from 'moment';
import moment from 'moment';

const { Title, Text } = Typography;

// Define event types and their colors
export enum EventType {
  FundingRound = 'funding-round',
  FinancialReport = 'financial-report',
  FounderMeeting = 'founder-meeting',
  Other = 'other'
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO format date string
  time?: string; // Optional time for the event
  description?: string;
  type: EventType;
}

interface FunderCalendarProps {
  events: CalendarEvent[];
}

export const FunderCalendar: React.FC<FunderCalendarProps> = ({ events }) => {
  const [selectedDate, setSelectedDate] = useState<Moment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [dateEvents, setDateEvents] = useState<CalendarEvent[]>([]);

  // Get status badge for different event types
  const getEventBadge = (type: EventType) => {
    switch(type) {
      case EventType.FundingRound:
        return { status: 'success', text: 'Funding Round' };
      case EventType.FinancialReport:
        return { status: 'warning', text: 'Financial Report' };
      case EventType.FounderMeeting:
        return { status: 'processing', text: 'Founder Meeting' };
      default:
        return { status: 'default', text: 'Other' };
    }
  };

  // Handler for date cell rendering
  const dateCellRender = (value: Moment) => {
    const dateStr = value.format('YYYY-MM-DD');
    const listData = events.filter(event => event.date.startsWith(dateStr));
    
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {listData.map(item => (
          <li key={item.id} style={{ marginBottom: '2px' }}>
            <Badge
              status={getEventBadge(item.type).status as any}
              text={item.title.length > 12 ? `${item.title.substring(0, 12)}...` : item.title}
              style={{ fontSize: '12px' }}
            />
          </li>
        ))}
      </ul>
    );
  };

  // Handler for month cell rendering
  const monthCellRender = (value: Moment) => {
    const monthStart = value.format('YYYY-MM');
    const listData = events.filter(event => event.date.startsWith(monthStart));
    
    if (listData.length === 0) {
      return null;
    }
    
    return (
      <div style={{ padding: '8px 0' }}>
        <Badge 
          count={listData.length} 
          style={{ backgroundColor: '#52c41a' }} 
        />
        <span style={{ marginLeft: 8 }}>Events</span>
      </div>
    );
  };

  // Handler for date selection
  const onSelect = (date: Moment) => {
    const dateStr = date.format('YYYY-MM-DD');
    const filteredEvents = events.filter(event => event.date.startsWith(dateStr));
    
    setSelectedDate(date);
    setDateEvents(filteredEvents);
    setModalVisible(filteredEvents.length > 0);
  };

  // Handler for calendar view change
  const onPanelChange = (date: Moment, mode: CalendarMode) => {
    console.log(date.format('YYYY-MM-DD'), mode);
  };

  return (
    <div className="funder-calendar">
      <Calendar 
        dateCellRender={dateCellRender} 
        monthCellRender={monthCellRender} 
        onSelect={onSelect}
        onPanelChange={onPanelChange}
      />
      
      <Modal
        title={selectedDate?.format('MMMM D, YYYY') ?? 'Events'}
        open={modalVisible}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            Close
          </Button>
        ]}
        onCancel={() => setModalVisible(false)}
      >
        <div>
          {dateEvents.map(event => (
            <div key={event.id} style={{ marginBottom: '16px', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={5} style={{ margin: 0 }}>{event.title}</Title>
                <Badge 
                  status={getEventBadge(event.type).status as any} 
                  text={getEventBadge(event.type).text} 
                />
              </div>
              {event.time && <Text type="secondary">{event.time}</Text>}
              {event.description && <p style={{ marginTop: '8px' }}>{event.description}</p>}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default FunderCalendar; 