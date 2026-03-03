import React from 'react'
import { SettingOutlined } from '@ant-design/icons'
import { Button, Popover, Typography } from 'antd'
import { CustomAvatar } from '../../custom-avatar'
import { AccountSettings } from '../account-settings'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

const { Text } = Typography

export const CurrentUser = () => {
    const [opened, setOpened] = React.useState(false)
    const { user } = useFullIdentity()


    const content = (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text strong style={{ padding: '12px 20px' }}>
                {user?.name}
            </Text>

            <div
                style={{
                    borderTop: '1px solid #d9d9d9',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                }}
            >
                <Button
                    style={{ textAlign: 'left' }}
                    icon={<SettingOutlined />}
                    type="text"
                    block
                    onClick={() => setOpened(true)}
                >
                    Account settings
                </Button>
            </div>
        </div>
    )

    return (
        <>
            <Popover
                placement="bottomRight"
                content={content}
                trigger="click"
                overlayInnerStyle={{ padding: 0 }}
                overlayStyle={{ zIndex: 999 }}
            >
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        height: 36,
                        padding: '4px 12px 4px 6px',
                        borderRadius: 999,
                        // border: '1px solid dodgerblue',
                        background: '#fff',
                        cursor: 'pointer',
                        userSelect: 'none',
                        boxSizing: 'border-box'
                    }}
                >
                    <CustomAvatar
                        name={user?.name}
                        photoUrl={user?.photoUrl}
                        size="default"
                        style={{ flex: '0 0 auto' }}
                    />

                    <span
                        style={{
                            fontWeight: 600,
                            lineHeight: '16px',
                            whiteSpace: 'nowrap'
                        }}
                        title={user?.name || ''}
                    >
                        {user?.name || 'User'}
                    </span>
                </div>
            </Popover>

            {user && (
                <AccountSettings opened={opened} setOpened={setOpened} userId={user.id} />
            )}
        </>
    )
}
