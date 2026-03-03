// App.tsx
// ───────────────────────────────────────────────────────────
// 🔹 Core Libraries
// ───────────────────────────────────────────────────────────
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ───────────────────────────────────────────────────────────
// 🔹 Refine Core & Utilities
// ───────────────────────────────────────────────────────────
import { Refine, Authenticated } from '@refinedev/core'
import routerProvider, {
    CatchAllNavigate,
    UnsavedChangesNotifier,
    DocumentTitleHandler
} from '@refinedev/react-router-v6'
import { useNotificationProvider } from '@refinedev/antd'
import { DevtoolsProvider } from '@refinedev/devtools'
import { RefineThemes } from '@refinedev/antd'

// ───────────────────────────────────────────────────────────
// 🔹 Ant Design
// ───────────────────────────────────────────────────────────
import { ConfigProvider, App as AntdApp } from 'antd'
import '@refinedev/antd/dist/reset.css'

// ───────────────────────────────────────────────────────────
// 🔹 Firebase Identity (centralized)
// ───────────────────────────────────────────────────────────
import { getAuth } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

// ───────────────────────────────────────────────────────────
// 🔹 App Providers
// ───────────────────────────────────────────────────────────
import { authProvider, dataProvider, liveProvider } from '@/providers'
import { SystemSettingsProvider } from './contexts/SystemSettingsContext'
import { AssignedInterventionsProvider } from '@/contexts/AssignedInterventionsContext'
import { SMEDetailsProvider } from './contexts/SMEDetailsContext'

// ───────────────────────────────────────────────────────────
// 🔹 Layout
// ───────────────────────────────────────────────────────────
import { CustomLayout } from '@/components/layout'

// ───────────────────────────────────────────────────────────
// 🔹 Public Pages
// ───────────────────────────────────────────────────────────
import { LoginPage } from '@/routes/login'
import { RegisterPage } from '@/routes/registration'
import { ResetPasswordPage } from './routes/reset-password'
import NotFoundPage from './routes/not-found'
import LandingPage from './routes/landing'
import SuccessStoryIntakePage from './routes/success-stories'

// ───────────────────────────────────────────────────────────
// 🔹 Director Routes
// ───────────────────────────────────────────────────────────
import DirectorDashboard from '@/routes/directors/directorDashboard'
import { DirectorOnboardingPage } from './routes/directors/onboarding'
import OperationsOnboardingDashboard from './routes/directors/operations'

// ───────────────────────────────────────────────────────────
// 🔹 Admin Routes
// ───────────────────────────────────────────────────────────
import FormManagement from '@/routes/admin/forms'
import { AdminDashboard } from '@/routes/admin/adminDashboard'

// ───────────────────────────────────────────────────────────
// 🔹 Operations Routes
// ───────────────────────────────────────────────────────────
import { OperationsDashboard } from '@/routes/operations/OperationsDashboard'
import OperationsParticipantsManagement from '@/routes/operations/participants'
import OperationsResourceManagement from '@/routes/operations/resources'
import OperationsCompliance from './routes/operations/compliance'
import OperationsReports from './routes/operations/reports'
import { InterventionsAssignemnts } from './routes/operations/assignments'
import ParticipantSuccess from './routes/operations/participants/success'
import { TasksManager } from './routes/operations/tasks'
import DiagnosticsDashboard from './routes/operations/diagnostics'
import ConsultantPerformance from './routes/operations/consultants/perfomance'
import IncubateePerformancePage from './routes/operations/participants/[id]/perfomance'
import { ConsultantPage } from './routes/operations/consultants'
import InterventionSuggestions from './components/interventions/InterventionsSuggestions'
import FormBuilder from './components/forms/builder'
import FormResponseViewer from './components/form-response-viewer/FormResponseViewer'
import TemplatesPage from './components/forms'
import FormBuilderPage from './components/forms/builder/[id]'
import FormSubmission from './components/form-submission/FormSubmission'
import AssessmentBuilder from './components/assessments/PostAssessmentBuilder'

// ───────────────────────────────────────────────────────────
// 🔹 Funder Routes
// ───────────────────────────────────────────────────────────
import { FunderDashboard } from '@/routes/funder/funderDashboard'
import { FunderAnalytics } from '@/routes/funder/analytics/funderAnalytics'
import InvestorDashboard from './routes/investor/investor/Dashboard'
import { FunderOpportunities } from './routes/investor/opportunities'
import { FunderPortfolio } from './routes/investor/portfolio'
import { FunderDocuments } from './routes/investor/documents'
import { FunderDueDiligence } from './routes/investor/due-diligence'
import FunderCalendarPage from './routes/investor/calendar'
import { GovernmentDashboard, ParticipantDirectory } from './routes/government'
import ProgramsDirectory from './routes/government/programs'
import { ImpactReports } from './routes/government/reports'

// ───────────────────────────────────────────────────────────
// 🔹 Incubatee Routes
// ───────────────────────────────────────────────────────────
import { IncubateeDashboard } from '@/routes/incubatee'
import SMEDashboard from './routes/incubatee/sme'
import ApplicationTracker from './routes/incubatee/tracker'
import { DocumentHub } from './routes/incubatee/documents/DocumentsHub'
import InterventionsTrackingView from './routes/incubatee/interventions'
import { MonthlyPerformanceForm } from './routes/incubatee/metrics'
import FinancialReportsInterface from './routes/incubatee/financials'
import IncubateeLayout from './components/IncubateeLayout'
import IncubateeAnalytics from './routes/incubatee/analytics'
import ProfileForm from './routes/incubatee/profile'
import GrowthPlanPage from './routes/incubatee/diagnostic'

// ───────────────────────────────────────────────────────────
// 🔹 Consultant Routes
// ───────────────────────────────────────────────────────────
import { ConsultantDashboard } from '@/routes/consultants/ConsultantDashboard'
import { InterventionTrack } from '@/routes/consultants/allocated/intervention'
import AppointmentsManager from './routes/consultants/appointments'
import AllocatedHistory from './routes/consultants/allocated/history'
import { FeedbackWorkspace } from '@/routes/consultants/feedback/FeedbackWorkspace'
import { ProjectAnalytics } from '@/routes/consultants/analytics/ProjectAnalytics'

// ───────────────────────────────────────────────────────────
// 🔹 Project Admin Routes
// ───────────────────────────────────────────────────────────
import { ProjectAdminDashboard } from './routes/projectadmin/projectAdminDashboard'
import MonitoringEvaluationSection from '@/routes/projectadmin/monitoring'
import { ImpactAnalysisForm } from './routes/projectadmin/impact'
import ProjectAdminReports from './routes/projectadmin/reports'

// ───────────────────────────────────────────────────────────
// 🔹 Registration Routes
// ───────────────────────────────────────────────────────────
import ParticipantFormalRegistration from './routes/registration/onboarding'

// ───────────────────────────────────────────────────────────
// 🔹 Utilities / Misc
// ───────────────────────────────────────────────────────────
import Chat from '@/routes/chat/chat'
import ApplicationsPage from './routes/applications'
import ProgramManager from './routes/programs'
import GenericProgramExpenseForm from './routes/expenses'
import SystemSetupForm from './routes/system'
import InterventionDatabaseView from './routes/interventions'
import { TasksEventsPage } from './routes/tasksEvents'

import CoursesManager from './routes/lms/operations/courses'
import { OperationsEnrollments } from './routes/lms/operations/enrollments'
import { OperationsGrades } from './routes/lms/operations/grades'
import CourseBuilder from './routes/lms/operations/courses/[id]'
import CourseAnalytics from './routes/lms/operations/analytics'
import ParticipantOnboardingForm from './routes/operations/participants/new/ParticipantOnboardingForm'

import { FirestoreExplorer } from './routes/admin/collections/FirestoreExplorer'
import { AdminEmailCenter } from './routes/admin/email'
import { UserManagement } from './components/user-management'
import WelcomeWizard from './routes/welcome'
import PortfolioPage from './routes/directors/portfolio'
import SectorsPage from './routes/directors/sectors/SectorPerformance'
import DirectorProgramsOverview from './routes/directors/programs'
import IncubateeFormsInbox from './routes/incubatee/inbox'
import TimedAssessmentRunner from './components/assessments/AssessmentRunner'
import { CompanySettingsPage } from './routes/directors/company'
import InterventionAppointments from './routes/shared/appointments/InterventionAppointments'


import SMEsMasterPage from './routes/shared/incubatees/SMEsMasterPage'
import AllocatedInterventions from './routes/shared/allocated/AllocatedInterventions'
import InterventionTracker from './routes/shared/allocated/[id]/InterventionTracker'
import UsersPage from './routes/operations/users/UsersPage'


type FullIdentity = {
    id: string
    email?: string | null
    name?: string
    companyCode?: string
    role?: string
    [k: string]: any
}

type FullIdentityCtx = {
    user: FullIdentity | null
    loading: boolean
}

const FullIdentityContext = createContext<FullIdentityCtx | null>(null)

export const useFullIdentity = () => {
    const ctx = useContext(FullIdentityContext)
    if (!ctx) throw new Error('useFullIdentity must be used within FullIdentityProvider')
    return ctx
}

const FullIdentityProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const [user, setUser] = useState<FullIdentity | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const auth = getAuth()
        const unsubscribe = auth.onAuthStateChanged(async currentUser => {
            try {
                if (!currentUser) {
                    setUser(null)
                    setLoading(false)
                    return
                }

                const userDocRef = doc(db, 'users', currentUser.uid)
                const userSnap = await getDoc(userDocRef)

                if (userSnap.exists()) {
                    setUser({
                        id: currentUser.uid,
                        email: currentUser.email,
                        name: currentUser.displayName || '',
                        ...(userSnap.data() as any)
                    })
                } else {
                    setUser({
                        id: currentUser.uid,
                        email: currentUser.email,
                        name: currentUser.displayName || ''
                    })
                }
            } catch {
                setUser(null)
            } finally {
                setLoading(false)
            }
        })

        return () => unsubscribe()
    }, [])

    const value = useMemo<FullIdentityCtx>(() => ({ user, loading }), [user, loading])

    return (
        <FullIdentityContext.Provider value={value}>
            {children}
        </FullIdentityContext.Provider>
    )
}

const queryClient = new QueryClient()

const App = () => {
    const notificationProvider = useNotificationProvider()

    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <ConfigProvider
                    theme={{
                        ...RefineThemes.Blue,
                        token: {
                            ...RefineThemes.Blue.token,
                            colorBgLayout: 'transparent'
                        },
                        components: {
                            Layout: {
                                headerBg: 'transparent',
                                bodyBg: 'transparent',
                                siderBg: 'transparent',
                                footerBg: 'transparent'
                            }
                        }
                    }}
                >
                    <FullIdentityProvider>
                        <SystemSettingsProvider>
                            <AssignedInterventionsProvider>
                                <SMEDetailsProvider>
                                    <AntdApp>
                                        <DevtoolsProvider>
                                            <Refine
                                                routerProvider={routerProvider}
                                                dataProvider={dataProvider}
                                                liveProvider={liveProvider}
                                                notificationProvider={notificationProvider}
                                                authProvider={authProvider}
                                                options={{
                                                    syncWithLocation: true,
                                                    warnWhenUnsavedChanges: true,
                                                    liveMode: 'auto',
                                                    useNewQueryKeys: true,
                                                    title: {
                                                        text: 'Smart Incubation Platform',
                                                        icon: null
                                                    }
                                                }}
                                            >
                                                <Routes>
                                                    <Route
                                                        element={
                                                            <Authenticated fallback={<CatchAllNavigate to='/login' />}>
                                                                <CustomLayout />
                                                            </Authenticated>
                                                        }
                                                    >
                                                        <Route path='admin'>
                                                            <Route index element={<AdminDashboard />} />
                                                            <Route path='email' element={<AdminEmailCenter />} />
                                                            <Route path='collections' element={<FirestoreExplorer />} />
                                                            <Route path='users' element={<UserManagement />} />
                                                            <Route path='forms' element={<FormManagement />} />
                                                        </Route>

                                                        <Route path='projectadmin'>
                                                            <Route index element={<ProjectAdminDashboard />} />
                                                            <Route path='impact' element={<ImpactAnalysisForm />} />
                                                            <Route path='indicative' element={<InterventionSuggestions />} />
                                                            <Route path='monitoring' element={<MonitoringEvaluationSection />} />
                                                            <Route path='reports' element={<ProjectAdminReports />} />
                                                        </Route>

                                                        <Route path='director'>
                                                            <Route index element={<DirectorDashboard />} />
                                                            <Route path='operators' element={<OperationsOnboardingDashboard />} />
                                                            <Route path='programs' element={<DirectorProgramsOverview />} />
                                                            <Route path='portfolio' element={<PortfolioPage />} />
                                                            <Route path='sectors' element={<SectorsPage />} />
                                                            <Route path='company' element={<CompanySettingsPage />} />
                                                        </Route>

                                                        <Route path='funder'>
                                                            <Route index element={<FunderDashboard />} />
                                                            <Route path='analytics' element={<FunderAnalytics />} />
                                                        </Route>

                                                        <Route path='incubatee'>
                                                            <Route index element={<IncubateeDashboard />} />
                                                            <Route path='interventions' element={<InterventionsTrackingView />} />
                                                            <Route path='forms' element={<IncubateeFormsInbox />} />
                                                            <Route path='/incubatee/diagnostic' element={<GrowthPlanPage />} />
                                                            <Route path='metrics' element={<MonthlyPerformanceForm />} />
                                                            <Route path='surveys/:id' element={<FormSubmission />} />
                                                            <Route path='assessments/:id' element={<TimedAssessmentRunner />} />
                                                            <Route path='financials' element={<FinancialReportsInterface />} />
                                                            <Route path='documents' element={<DocumentHub />} />
                                                            <Route path='profile' element={<ProfileForm />} />
                                                        </Route>

                                                        <Route path='investor'>
                                                            <Route index element={<InvestorDashboard />} />
                                                            <Route path='opportunities' element={<FunderOpportunities />} />
                                                            <Route path='portfolio' element={<FunderPortfolio />} />
                                                            <Route path='due-diligence' element={<FunderDueDiligence />} />
                                                            <Route path='analytics' element={<FunderAnalytics />} />
                                                            <Route path='documents' element={<FunderDocuments />} />
                                                            <Route path='calendar' element={<FunderCalendarPage />} />
                                                        </Route>

                                                        <Route path='consultant'>
                                                            <Route index element={<ConsultantDashboard />} />
                                                            <Route path='assessments/post' element={<AssessmentBuilder />} />
                                                            <Route path='indicative' element={<InterventionSuggestions />} />
                                                            <Route path='appointments' element={<AppointmentsManager />} />
                                                            <Route path='feedback' element={<FeedbackWorkspace />} />
                                                            <Route path='analytics' element={<ProjectAnalytics />} />
                                                            <Route path='allocated/history' element={<AllocatedHistory />} />
                                                            <Route path='allocated'>
                                                                <Route index element={<AllocatedInterventions />} />
                                                                <Route path='intervention/:id' element={<InterventionTrack />} />
                                                            </Route>
                                                            <Route path='participants'>
                                                                <Route index element={<OperationsParticipantsManagement />} />
                                                                <Route path='new' element={<ParticipantOnboardingForm />} />
                                                                <Route path='success' element={<ParticipantSuccess />} />
                                                            </Route>
                                                        </Route>

                                                        <Route path='operations'>
                                                            <Route index element={<OperationsDashboard />} />
                                                            <Route path='tasks' element={<TasksManager />} />
                                                            <Route path='success-stories' element={<SuccessStoryIntakePage />} />
                                                            <Route path='assignments' element={<InterventionsAssignemnts />} />
                                                            <Route path='diagnostics' element={<DiagnosticsDashboard />} />
                                                            <Route path='surveys' element={<TemplatesPage />} />
                                                            <Route path='surveys/builder' element={<FormBuilderPage />} />
                                                            <Route path='surveys/builder/:id' element={<FormBuilder />} />
                                                            <Route path='surveys/view' element={<FormResponseViewer />} />
                                                            <Route path='assessments/builder/:id' element={<AssessmentBuilder />} />
                                                            <Route path='assessments/builder' element={<AssessmentBuilder />} />
                                                            <Route path='participants'>
                                                                <Route index element={<OperationsParticipantsManagement />} />
                                                                <Route path='new' element={<ParticipantOnboardingForm />} />
                                                                <Route path='success' element={<ParticipantSuccess />} />
                                                            </Route>
                                                            <Route
                                                                path='/operations/participants/:participantId/performance'
                                                                element={<IncubateePerformancePage />}
                                                            />
                                                            <Route path='consultants'>
                                                                <Route index element={<ConsultantPage />} />
                                                                <Route path=':id/performance' element={<ConsultantPerformance />} />
                                                            </Route>
                                                            <Route path='users'>
                                                                <Route index element={<UsersPage />} />
                                                                <Route path=':id/performance' element={<ConsultantPerformance />} />
                                                            </Route>
                                                            <Route path='resources' element={<OperationsResourceManagement />} />
                                                            <Route path='indicative' element={<InterventionSuggestions />} />
                                                            <Route path='compliance' element={<OperationsCompliance />} />
                                                            <Route path='reports' element={<OperationsReports />} />
                                                        </Route>

                                                        <Route path='government'>
                                                            <Route index element={<GovernmentDashboard />} />
                                                            <Route path='analytics' element={<FunderAnalytics />} />
                                                            <Route index element={<GovernmentDashboard />} />
                                                            <Route path='participants' element={<ParticipantDirectory />} />
                                                            <Route path='programs' element={<ProgramsDirectory />} />
                                                            <Route path='reports' element={<ImpactReports />} />
                                                        </Route>

                                                        <Route path='shared'>
                                                            <Route path='appointments' element={<InterventionAppointments />} />
                                                            <Route path='incubatees' element={<SMEsMasterPage />} />
                                                            <Route path='allocated'>
                                                                <Route index element={<AllocatedInterventions />} />
                                                                <Route path=':id' element={<InterventionTracker />} />
                                                            </Route>
                                                        </Route>

                                                        <Route path='interventions' element={<InterventionDatabaseView />} />
                                                        <Route path='tasksEvents' element={<TasksEventsPage />} />
                                                        <Route path='chat' element={<Chat />} />

                                                        <Route path='expenses' element={<GenericProgramExpenseForm />} />
                                                        <Route path='system' element={<SystemSetupForm />} />

                                                        <Route path='lms/operations'>
                                                            <Route index element={<CoursesManager />} />
                                                            <Route path='courses/:id' element={<CourseBuilder />} />
                                                            <Route path='courses' element={<CoursesManager />} />
                                                            <Route path='enrollments' element={<OperationsEnrollments />} />
                                                            <Route path='grades' element={<OperationsGrades />} />
                                                            <Route path='analytics/:id' element={<CourseAnalytics />} />
                                                        </Route>

                                                        <Route path='applications' element={<ApplicationsPage />} />
                                                        <Route path='programs' element={<ProgramManager />} />
                                                    </Route>

                                                    <Route element={<IncubateeLayout />}>
                                                        <Route path='/incubatee-apply/sme' element={<SMEDashboard />} />
                                                        <Route path='/incubatee-apply/tracker' element={<ApplicationTracker />} />
                                                        <Route path='/incubatee-apply/profile' element={<ProfileForm />} />
                                                        <Route path='/incubatee-apply/analytics' element={<IncubateeAnalytics />} />
                                                    </Route>

                                                    <Route path='/' element={<LandingPage />} />
                                                    <Route path='/landing/sme' element={<SMEDashboard />} />
                                                    <Route path='/login' element={<LoginPage />} />
                                                    <Route path='/reset-password' element={<ResetPasswordPage />} />
                                                    <Route path='welcome' element={<WelcomeWizard />} />

                                                    <Route path='/director/onboarding' element={<DirectorOnboardingPage />} />
                                                    <Route path='/registration'>
                                                        <Route index element={<RegisterPage />} />
                                                        <Route path='/registration/onboarding' element={<ParticipantFormalRegistration />} />
                                                    </Route>

                                                    <Route path='*' element={<NotFoundPage />} />
                                                </Routes>

                                                <UnsavedChangesNotifier />
                                                <DocumentTitleHandler />
                                            </Refine>
                                        </DevtoolsProvider>
                                    </AntdApp>
                                </SMEDetailsProvider>
                            </AssignedInterventionsProvider>
                        </SystemSettingsProvider>
                    </FullIdentityProvider>
                </ConfigProvider>
            </BrowserRouter>
        </QueryClientProvider>
    )
}

export default App
