import React, { useEffect, useMemo, useState } from "react"
import {
    Card,
    Form,
    Input,
    Button,
    Select,
    Space,
    Typography,
    Divider,
    message,
    Modal,
    Alert,
    Tag,
    Row,
    Col,
    Statistic,
    Segmented,
    Progress,
    Tooltip,
    Empty,
    Badge
} from "antd"
import {
    MailOutlined,
    SendOutlined,
    ExperimentOutlined,
    EyeOutlined,
    ReloadOutlined,
    TeamOutlined,
    FileTextOutlined,
    UserOutlined,
    CheckCircleOutlined
} from "@ant-design/icons"
import { collection, getDocs, orderBy, query, where } from "firebase/firestore"
import { auth, db } from "@/firebase"
import { useFullIdentity } from "@/hooks/useFullIdentity"
import { DashboardHeaderCard } from "@/components/shared/Header"

const { Title, Text } = Typography

const FUNCTIONS_BASE_URL =
    import.meta.env.VITE_FUNCTIONS_BASE_URL ||
    "https://us-central1-incubation-platform-61610.cloudfunctions.net"

type UserRow = {
    uid: string
    email: string
    name?: string
    role?: string
    companyCode?: string
    departmentName?: string
}

type TemplateRow = {
    id: string
    name: string
    subject: string
    html: string
    enabled?: boolean
}

export const AdminEmailCenter: React.FC = () => {
    const [form] = Form.useForm()

    const { identity } = useFullIdentity() as any
    const companyCode = String(identity?.companyCode || "")

    const [users, setUsers] = useState<UserRow[]>([])
    const [templates, setTemplates] = useState<TemplateRow[]>([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [sending, setSending] = useState(false)

    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewSubject, setPreviewSubject] = useState("")
    const [previewHtml, setPreviewHtml] = useState("")

    const [testOpen, setTestOpen] = useState(false)
    const [testEmailTo, setTestEmailTo] = useState("")
    const [testing, setTesting] = useState(false)

    const [mode, setMode] = useState<"template" | "custom">("template")
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)

    // Recipient helpers (UX upgrades)
    const [roleFilter, setRoleFilter] = useState<string>("all")

    const enabledTemplates = useMemo(
        () => templates.filter(t => t.enabled !== false),
        [templates]
    )

    const selectedTemplate = useMemo(
        () => enabledTemplates.find(t => t.id === selectedTemplateId),
        [enabledTemplates, selectedTemplateId]
    )

    const filteredUsers = useMemo(() => {
        if (roleFilter === "all") return users
        return users.filter(u => String(u.role || "").toLowerCase() === roleFilter)
    }, [users, roleFilter])

    const userOptions = useMemo(
        () =>
            filteredUsers
                .filter(u => !!u.email)
                .map(u => ({
                    label: `${u.name || u.email} • ${u.role || "user"}`,
                    value: u.email.toLowerCase()
                })),
        [filteredUsers]
    )

    const roleOptions = useMemo(() => {
        const roles = Array.from(
            new Set(users.map(u => String(u.role || "").toLowerCase()).filter(Boolean))
        ).sort()
        return ["all", ...roles]
    }, [users])

    const loadUsers = async () => {
        if (!companyCode) return
        setLoadingUsers(true)
        try {
            const q = query(
                collection(db, "users"),
                where("companyCode", "==", companyCode),
                orderBy("name", "asc")
            )
            const snap = await getDocs(q)
            const rows: UserRow[] = snap.docs.map(d => {
                const data = d.data() as any
                return {
                    uid: d.id,
                    email: String(data.email || "").toLowerCase(),
                    name: data.name || "",
                    role: data.role || "",
                    companyCode: data.companyCode || "",
                    departmentName: data.departmentName || ""
                }
            })
            setUsers(rows)
        } catch (e) {
            console.error(e)
            message.error("Failed to load users.")
        } finally {
            setLoadingUsers(false)
        }
    }

    const loadTemplates = async () => {
        setLoadingTemplates(true)
        try {
            const q = query(collection(db, "emailTemplates"), orderBy("name", "asc"))
            const snap = await getDocs(q)
            const rows: TemplateRow[] = snap.docs.map(d => {
                const data = d.data() as any
                return {
                    id: d.id,
                    name: String(data.name || d.id),
                    subject: String(data.subject || ""),
                    html: String(data.html || ""),
                    enabled: data.enabled !== false
                }
            })
            setTemplates(rows)

            const first = rows.find(r => r.enabled !== false)
            if (first) {
                setSelectedTemplateId(first.id)
                form.setFieldsValue({ templateId: first.id })
            }
        } catch (e) {
            console.error(e)
            message.error("Failed to load email templates.")
        } finally {
            setLoadingTemplates(false)
        }
    }

    useEffect(() => {
        loadUsers()
        loadTemplates()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyCode])

    useEffect(() => {
        if (mode === "template" && selectedTemplate) {
            form.setFieldsValue({
                subject: selectedTemplate.subject,
                html: selectedTemplate.html
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, selectedTemplateId])

    const getIdToken = async () => {
        const user = auth.currentUser
        if (!user) throw new Error("Not authenticated")
        return await user.getIdToken(true)
    }

    const callFunction = async (path: string, payload: any) => {
        const token = await getIdToken()
        const res = await fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.ok === false) {
            const detail = data?.detail || data?.error || "request_failed"
            throw new Error(detail)
        }
        return data
    }

    const normalizeEmails = (vals: string[]) => {
        const rx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const cleaned = (vals || [])
            .map(v => String(v || "").trim().toLowerCase())
            .filter(v => rx.test(v))
        return [...new Set(cleaned)]
    }

    const recipientsFromForm = useMemo(() => {
        const vals = form.getFieldsValue?.() || {}
        const selectedUsers: string[] = vals.recipients || []
        const customRaw = String(vals.customEmails || "")
            .split(/[\s,;]+/g)
            .map(s => s.trim())
            .filter(Boolean)

        return normalizeEmails([...selectedUsers, ...customRaw])
    }, [form])

    const onPreview = () => {
        const values = form.getFieldsValue()
        const subject = String(values.subject || "").trim()
        const html = String(values.html || "").trim()
        if (!subject || !html) return message.error("Subject and HTML are required for preview.")
        setPreviewSubject(subject)
        setPreviewHtml(html)
        setPreviewOpen(true)
    }

    const onSend = async () => {
        const values = await form.validateFields()

        const recipientsFromUsers: string[] = values.recipients || []
        const customEmailsRaw = String(values.customEmails || "")
            .split(/[\s,;]+/g)
            .map(s => s.trim())
            .filter(Boolean)

        const recipients = normalizeEmails([...recipientsFromUsers, ...customEmailsRaw])
        if (!recipients.length) return message.error("Select at least one recipient.")

        const payload: any = { companyCode, recipients }

        if (mode === "template") {
            const templateId = String(values.templateId || "").trim()
            if (!templateId) return message.error("Select a template.")
            payload.templateId = templateId
        } else {
            const subject = String(values.subject || "").trim()
            const html = String(values.html || "").trim()
            if (!subject || !html) return message.error("Subject and email body are required.")
            payload.subject = subject
            payload.html = html
        }

        setSending(true)
        try {
            const result = await callFunction("adminSendEmail", payload)
            message.success(`Sent: ${result.sent}, Failed: ${result.failed}`)
            form.setFieldsValue({ customEmails: "" })
        } catch (e: any) {
            console.error(e)
            message.error(`Send failed: ${String(e.message || e)}`)
        } finally {
            setSending(false)
        }
    }

    const onTestEmail = async () => {
        const to = String(testEmailTo || "").trim().toLowerCase()
        if (!to) return message.error("Enter a test email address.")
        setTesting(true)
        try {
            const result = await callFunction("testEmail", { to })
            message.success(`Test sent ✅ (${result.messageId || "ok"})`)
            setTestOpen(false)
            setTestEmailTo("")
        } catch (e: any) {
            console.error(e)
            message.error(`Test failed: ${String(e.message || e)}`)
        } finally {
            setTesting(false)
        }
    }

    const onSelectAllFiltered = () => {
        const emails = filteredUsers.map(u => String(u.email || "").toLowerCase()).filter(Boolean)
        form.setFieldsValue({ recipients: normalizeEmails(emails) })
    }

    const metrics = useMemo(() => {
        const totalUsers = users.length
        const totalTemplates = enabledTemplates.length
        const selected = recipientsFromForm.length
        const ready = companyCode && totalUsers > 0 && totalTemplates > 0
        return { totalUsers, totalTemplates, selected, ready }
    }, [users.length, enabledTemplates.length, recipientsFromForm.length, companyCode])

    const sendReadiness = useMemo(() => {
        // simple UI signal
        const pct = Math.min(100, Math.round((metrics.selected / Math.max(1, metrics.totalUsers)) * 100))
        return pct
    }, [metrics.selected, metrics.totalUsers])

    return (
        <div style={{ padding: 24, minHeight: '100vh' }}>
            <DashboardHeaderCard
                title={
                    <Space size={8}>
                        <MailOutlined />
                        <span>Admin Email Center</span>
                    </Space>
                }
                subtitle={
                    <Text type="secondary">
                        Templates + custom emails, with preview, test, and recipient controls.
                    </Text>
                }
                extraRight={
                    <Space>
                        <Button
                            icon={<ExperimentOutlined />}
                            onClick={() => setTestOpen(true)}
                        >
                            Test SMTP
                        </Button>

                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                loadUsers()
                                loadTemplates()
                            }}
                            loading={loadingUsers || loadingTemplates}
                        >
                            Refresh Data
                        </Button>
                    </Space>
                }
            />

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} md={6}>
                    <Card>
                        <Statistic title="Users" value={metrics.totalUsers} prefix={<TeamOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card>
                        <Statistic title="Enabled Templates" value={metrics.totalTemplates} prefix={<FileTextOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card>
                        <Statistic title="Recipients Selected" value={metrics.selected} prefix={<UserOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} md={6}>
                    <Card>
                        <Statistic
                            title="Send Readiness"
                            value={sendReadiness}
                            suffix="%"
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            <div style={{ marginTop: 16 }}>
                <Alert
                    type="info"
                    showIcon
                    message="Delivery tip"
                    description="If emails are not sending, use Test SMTP first. Then check Firebase Functions logs for the exact Nodemailer error."
                />
            </div>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                {/* Composer */}
                <Col xs={24} lg={16}>
                    <Card
                        title={
                            <Space>
                                <Badge color="blue" />
                                <Text strong>Email Composer</Text>
                                <Tag color="blue">Company: {companyCode || "Unknown"}</Tag>
                            </Space>
                        }
                        loading={loadingUsers || loadingTemplates}
                    >
                        <Form
                            form={form}
                            layout="vertical"
                            initialValues={{
                                mode: "template",
                                recipients: [],
                                customEmails: ""
                            }}
                        >
                            <Form.Item label="Mode" name="mode">
                                <Segmented
                                    options={[
                                        { label: "Template", value: "template", icon: <FileTextOutlined /> as any },
                                        { label: "Custom", value: "custom", icon: <MailOutlined /> as any }
                                    ]}
                                    onChange={(v: any) => {
                                        setMode(v)
                                        if (v === "template") {
                                            const first = enabledTemplates[0]
                                            if (first) {
                                                setSelectedTemplateId(first.id)
                                                form.setFieldsValue({
                                                    templateId: first.id,
                                                    subject: first.subject,
                                                    html: first.html
                                                })
                                            }
                                        }
                                    }}
                                />
                            </Form.Item>

                            <Row gutter={[12, 12]}>
                                <Col xs={24} md={12}>
                                    <Form.Item label="Filter users by role">
                                        <Select
                                            value={roleFilter}
                                            onChange={setRoleFilter}
                                            options={roleOptions.map(r => ({
                                                value: r,
                                                label: r === "all" ? "All roles" : r
                                            }))}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item label="Quick actions">
                                        <Space>
                                            <Tooltip title="Select everyone in the current filtered list">
                                                <Button onClick={onSelectAllFiltered} icon={<TeamOutlined />}>
                                                    Select All (Filtered)
                                                </Button>
                                            </Tooltip>
                                            <Button onClick={() => form.setFieldsValue({ recipients: [] })}>
                                                Clear
                                            </Button>
                                        </Space>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item name="recipients" label="Recipients (users)">
                                <Select
                                    mode="multiple"
                                    showSearch
                                    allowClear
                                    placeholder="Search users by name/email..."
                                    loading={loadingUsers}
                                    options={userOptions}
                                    filterOption={(input, option) =>
                                        String(option?.label || "").toLowerCase().includes(input.toLowerCase())
                                    }
                                    notFoundContent={<Empty description="No users match this filter" />}
                                />
                            </Form.Item>

                            <Form.Item
                                name="customEmails"
                                label="Add extra emails (optional)"
                                tooltip="Comma/space separated. These are added to selected users."
                            >
                                <Input.TextArea rows={2} placeholder="someone@gmail.com other@company.com" />
                            </Form.Item>

                            {mode === "template" ? (
                                <>
                                    <Form.Item
                                        name="templateId"
                                        label="Template"
                                        rules={[{ required: true, message: "Select a template" }]}
                                    >
                                        <Select
                                            placeholder="Select template..."
                                            options={enabledTemplates.map(t => ({ label: t.name, value: t.id }))}
                                            onChange={(id: string) => {
                                                setSelectedTemplateId(id)
                                                const t = enabledTemplates.find(x => x.id === id)
                                                if (t) form.setFieldsValue({ subject: t.subject, html: t.html })
                                            }}
                                            showSearch
                                            filterOption={(input, option) =>
                                                String(option?.label || "").toLowerCase().includes(input.toLowerCase())
                                            }
                                        />
                                    </Form.Item>

                                    <Alert
                                        type="warning"
                                        showIcon
                                        message="Template mode"
                                        description="Templates are sent exactly as stored. Use Preview to confirm rendering."
                                        style={{ marginBottom: 12 }}
                                    />
                                </>
                            ) : (
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Custom mode"
                                    description="Write your own subject + HTML. Keep it short and clean."
                                    style={{ marginBottom: 12 }}
                                />
                            )}

                            <Form.Item
                                name="subject"
                                label="Subject"
                                rules={[{ required: mode === "custom", message: "Subject is required" }]}
                            >
                                <Input placeholder="Email subject..." disabled={mode === "template"} />
                            </Form.Item>

                            <Form.Item
                                name="html"
                                label="Email HTML Body"
                                rules={[{ required: mode === "custom", message: "Email body is required" }]}
                            >
                                <Input.TextArea rows={8} placeholder="<div>...</div>" disabled={mode === "template"} />
                            </Form.Item>

                            <Space>
                                <Button icon={<EyeOutlined />} onClick={onPreview}>
                                    Preview
                                </Button>

                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    loading={sending}
                                    onClick={onSend}
                                    disabled={!companyCode}
                                >
                                    Send
                                </Button>
                            </Space>
                        </Form>
                    </Card>
                </Col>

                {/* Insights / summary */}
                <Col xs={24} lg={8}>
                    <Card
                        title={<Space><MailOutlined /><Text strong>Send Summary</Text></Space>}
                    >
                        <Space direction="vertical" style={{ width: "100%" }} size={12}>
                            <div>
                                <Text type="secondary">Mode</Text>
                                <div style={{ fontWeight: 600 }}>
                                    {mode === "template" ? "Template" : "Custom"}
                                </div>
                            </div>

                            {mode === "template" ? (
                                <div>
                                    <Text type="secondary">Selected Template</Text>
                                    <div style={{ fontWeight: 600 }}>
                                        {selectedTemplate?.name || "None"}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <Text type="secondary">Custom subject</Text>
                                    <div style={{ fontWeight: 600 }}>
                                        {String(form.getFieldValue("subject") || "").trim() || "—"}
                                    </div>
                                </div>
                            )}

                            <Divider style={{ margin: "8px 0" }} />

                            <div>
                                <Text type="secondary">Recipients</Text>
                                <div style={{ fontWeight: 700, fontSize: 18 }}>
                                    {recipientsFromForm.length}
                                </div>
                            </div>

                            <div>
                                <Text type="secondary">Readiness</Text>
                                <Progress percent={sendReadiness} />
                            </div>

                            <Alert
                                type="success"
                                showIcon
                                message="Best practice"
                                description="Always preview first. If SMTP fails, Test SMTP and check logs (TLS/auth)."
                            />
                        </Space>
                    </Card>
                </Col>
            </Row>

            {/* Preview */}
            <Modal
                open={previewOpen}
                onCancel={() => setPreviewOpen(false)}
                footer={[
                    <Button key="close" onClick={() => setPreviewOpen(false)}>
                        Close
                    </Button>
                ]}
                title="Email Preview"
                width={900}
            >
                <div style={{ marginBottom: 8 }}>
                    <Text strong>Subject: </Text>
                    <Text>{previewSubject}</Text>
                </div>
                <Divider />
                <div
                    style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 16,
                        background: "#fff"
                    }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
            </Modal>

            {/* Test Email */}
            <Modal
                open={testOpen}
                onCancel={() => setTestOpen(false)}
                onOk={onTestEmail}
                okText="Send Test"
                confirmLoading={testing}
                title="Test SMTP (Send test email)"
            >
                <Input
                    value={testEmailTo}
                    onChange={e => setTestEmailTo(e.target.value)}
                    placeholder="you@domain.com"
                />
            </Modal>
        </div>
    )
}
