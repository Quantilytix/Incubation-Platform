import React, { useEffect, useState } from 'react'
import { Upload, message } from 'antd'
import { EditOutlined, LoadingOutlined } from '@ant-design/icons'
import { useGetIdentity } from '@refinedev/core'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { getCompanyLogoUrl, uploadCompanyLogo } from '@/utilities/firebaseLogo'

export const CompanyLogo: React.FC<{ collapsed: boolean }> = ({
  collapsed
}) => {
  const { data: identity } = useGetIdentity()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [companyCode, setCompanyCode] = useState<string>('')
  const [role, setRole] = useState<string>('')

  useEffect(() => {
    const fetchCompanyLogo = async () => {
      if (!identity?.id) return
      const userSnap = await getDoc(doc(db, 'users', String(identity.id)))
      const userData = userSnap.data()
      const code = userData?.companyCode
      const role = userData?.role?.toLowerCase()?.replace(/\s+/g, '')
      setRole(role)
      if (code) {
        setCompanyCode(code)
        const url = await getCompanyLogoUrl(code)
        setLogoUrl(url)
      }
    }
    fetchCompanyLogo()
  }, [identity])

  const handleUpload = async ({ file, onSuccess, onError }: any) => {
    if (!companyCode) return
    try {
      setLogoUploading(true)
      const url = await uploadCompanyLogo(file as File, companyCode)
      setLogoUrl(url)
      message.success('Logo updated successfully')
      onSuccess?.('ok')
    } catch (error) {
      console.error(error)
      message.error('Logo upload failed')
      onError?.(error)
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <>
      {role === 'director' ? (
        <Upload showUploadList={false} customRequest={handleUpload}>
          <div
            style={{
              position: 'relative',
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              boxSizing: 'border-box',
              borderBottom: '1px solid #f0f0f0',
              cursor: 'pointer'
            }}
          >
            <img
              src={logoUrl || '/assets/images/impala.png'}
              alt='Logo'
              style={{
                maxHeight: '100%',
                maxWidth: '100%',
                height: 'auto',
                width: collapsed ? '40px' : '120px',
                transition: 'width 0.2s ease-in-out',
                objectFit: 'contain'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: '#fff',
                borderRadius: '50%',
                padding: 4,
                boxShadow: '0 0 4px rgba(0,0,0,0.2)'
              }}
            >
              {logoUploading ? (
                <LoadingOutlined spin />
              ) : (
                <EditOutlined style={{ fontSize: 16 }} />
              )}
            </div>
          </div>
        </Upload>
      ) : (
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            boxSizing: 'border-box',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <img
            src={logoUrl || '/assets/images/impala.png'}
            alt='Logo'
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              height: 'auto',
              width: collapsed ? '40px' : '120px',
              transition: 'width 0.2s ease-in-out',
              objectFit: 'contain'
            }}
          />
        </div>
      )}
    </>
  )
}
