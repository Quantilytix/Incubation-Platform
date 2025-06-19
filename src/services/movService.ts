// MOV (Means of Verification) Service
// Handles CRUD operations for MOV documents

import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  Timestamp 
} from 'firebase/firestore'
import { db } from '@/firebase'
import { 
  MOVDocument, 
  MOVCreationInput, 
  MOVUpdateInput, 
  MOVQueryFilters,
  MOVDocumentFirestore,
  MOVSummary,
  MOVStatus 
} from '@/types/mov'

/**
 * Collection reference for MOV documents
 */
const MOV_COLLECTION = 'movDocuments'

/**
 * Convert Firestore document to MOVDocument
 * Handles Timestamp to Date conversion
 */
const convertFirestoreToMOV = (doc: any): MOVDocument => {
  const data = doc.data() as MOVDocumentFirestore
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt.toDate(),
    updatedAt: data.updatedAt.toDate(),
    interventionDate: data.interventionDate.toDate(),
    dateChecked: data.dateChecked?.toDate(),
  }
}

/**
 * Convert MOVDocument to Firestore format
 * Handles Date to Timestamp conversion
 */
const convertMOVToFirestore = (mov: Partial<MOVDocument>): Partial<MOVDocumentFirestore> => {
  const { createdAt, updatedAt, interventionDate, dateChecked, ...rest } = mov
  return {
    ...rest,
    createdAt: createdAt ? Timestamp.fromDate(createdAt) : undefined,
    updatedAt: updatedAt ? Timestamp.fromDate(updatedAt) : undefined,
    interventionDate: interventionDate ? Timestamp.fromDate(interventionDate) : undefined,
    dateChecked: dateChecked ? Timestamp.fromDate(dateChecked) : undefined,
  }
}

/**
 * Generate a new MOV document from intervention data
 * Called automatically when interventions are completed
 */
export const generateMOVDocument = async (input: MOVCreationInput): Promise<string> => {
  try {
    // Validate input data
    if (!validateMOVData(input)) {
      throw new Error('Invalid MOV data provided')
    }

    // Create MOV document with generated fields
    const movData: Partial<MOVDocumentFirestore> = {
      // Core intervention data
      interventionKey: input.interventionKey,
      participantId: input.participantId,
      beneficiaryName: input.beneficiaryName,
      interventionTitle: input.interventionTitle,
      interventionType: input.interventionType,
      interventionDate: Timestamp.fromDate(input.interventionDate),
      
      // Facilitator information
      facilitatorName: input.facilitatorName,
      facilitatorId: input.facilitatorId,
      
      // SMME Information (from input if available, omit if undefined)
      ...(input.smmeNo && { smmeNo: input.smmeNo }),
      ...(input.smmeSector && { smmeSector: input.smmeSector }),
      groupStage: input.groupStage || 'A',
      
      // Intervention details
      interventionMethod: input.interventionMethod || 'In-person',
      ...(input.frequencyOfIntervention && { frequencyOfIntervention: input.frequencyOfIntervention }),
      
      // Status and metadata
      status: 'generated' as MOVStatus,
      companyCode: input.companyCode,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
      
      // Note: Optional fields like notes, dateChecked, finalCheckerName are omitted entirely
      // rather than set to undefined, as Firestore doesn't accept undefined values
    }

    // Add the document to Firestore
    const docRef = await addDoc(collection(db, MOV_COLLECTION), movData)
    
    console.log('MOV document created successfully:', docRef.id)
    return docRef.id

  } catch (error) {
    console.error('Error generating MOV document:', error)
    throw error
  }
}

/**
 * Get MOV document by ID
 */
export const getMOVDocument = async (id: string): Promise<MOVDocument | null> => {
  // TODO: Implement in Task 5-4
  // This function will be implemented when building MOV detail views
  throw new Error('getMOVDocument not yet implemented - pending Task 5-4')
}

/**
 * Get MOV documents for a specific participant
 */
export const getMOVDocumentsByParticipant = async (
  participantId: string, 
  companyCode: string
): Promise<MOVDocument[]> => {
  try {
    // Simplified query without orderBy to avoid index requirement
    const q = query(
      collection(db, MOV_COLLECTION),
      where('participantId', '==', participantId),
      where('companyCode', '==', companyCode)
    )

    const querySnapshot = await getDocs(q)
    
    if (querySnapshot.empty) {
      console.log(`No MOV documents found for participant: ${participantId}`)
      return []
    }

    // Convert all documents from Firestore format
    const movDocuments = querySnapshot.docs.map(doc => convertFirestoreToMOV(doc))
    
    // Sort by intervention date in JavaScript instead of Firestore
    movDocuments.sort((a, b) => b.interventionDate.getTime() - a.interventionDate.getTime())
    
    console.log(`Found ${movDocuments.length} MOV documents for participant:`, participantId)
    return movDocuments

  } catch (error) {
    console.error('Error fetching MOV documents by participant:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      participantId,
      companyCode
    })
    return []
  }
}

/**
 * Query MOV documents with filters
 */
export const queryMOVDocuments = async (
  filters: MOVQueryFilters,
  companyCode: string
): Promise<MOVDocument[]> => {
  // TODO: Implement in Task 5-4
  // This function will be implemented when building MOV list views
  throw new Error('queryMOVDocuments not yet implemented - pending Task 5-4')
}

/**
 * Update MOV document (signatures, verification, etc.)
 */
export const updateMOVDocument = async (
  id: string, 
  updates: MOVUpdateInput
): Promise<void> => {
  // TODO: Implement in Task 5-4
  // This function will be implemented when building MOV detail views
  throw new Error('updateMOVDocument not yet implemented - pending Task 5-4')
}

/**
 * Get MOV summary statistics
 */
export const getMOVSummary = async (companyCode: string): Promise<MOVSummary> => {
  // TODO: Implement in Task 5-4
  // This function will be implemented when building MOV list views
  throw new Error('getMOVSummary not yet implemented - pending Task 5-4')
}

/**
 * Get MOV documents by intervention key
 * Useful for checking if MOV already exists for an intervention
 */
export const getMOVByInterventionKey = async (
  interventionKey: string,
  companyCode: string
): Promise<MOVDocument | null> => {
  try {
    const q = query(
      collection(db, MOV_COLLECTION),
      where('interventionKey', '==', interventionKey),
      where('companyCode', '==', companyCode)
    )

    const querySnapshot = await getDocs(q)
    
    if (querySnapshot.empty) {
      return null
    }

    // Return the first matching document (should be unique per interventionKey)
    const doc = querySnapshot.docs[0]
    return convertFirestoreToMOV(doc)

  } catch (error) {
    console.error('Error fetching MOV by intervention key:', error)
    return null
  }
}

/**
 * Utility function to validate MOV data before creation/update
 */
export const validateMOVData = (data: Partial<MOVDocument> | MOVCreationInput): boolean => {
  // Basic required field validation
  if (!data.interventionKey || !data.participantId || !data.beneficiaryName) {
    return false
  }
  
  if (!data.interventionTitle || !data.facilitatorName || !data.facilitatorId) {
    return false
  }
  
  if (!data.companyCode) {
    return false
  }
  
  // For MOVCreationInput, also check interventionType and interventionDate
  if ('interventionType' in data && !data.interventionType) {
    return false
  }
  
  if ('interventionDate' in data && !data.interventionDate) {
    return false
  }
  
  return true
}

/**
 * Utility function to determine if MOV can be auto-generated for intervention
 */
export const canGenerateMOV = (interventionData: any): boolean => {
  // TODO: Implement validation logic
  // This can be implemented now as it's part of data structure definition
  
  // Check if intervention has required fields for MOV generation
  const hasRequiredFields = !!(
    interventionData.interventionKey &&
    interventionData.participantId &&
    interventionData.beneficiaryName &&
    interventionData.interventionTitle &&
    interventionData.consultantIds?.length > 0 &&
    interventionData.confirmedAt &&
    interventionData.companyCode
  )
  
  return hasRequiredFields
}

/**
 * Auto-generate MOV document from intervention database entry
 * This is the main function called when interventions are confirmed
 */
export const autoGenerateMOVFromIntervention = async (
  interventionKey: string,
  interventionData: any,
  participantData: any,
  facilitatorData?: any
): Promise<string | null> => {
  try {
    // Check if MOV already exists
    const existingMOV = await getMOVByInterventionKey(
      interventionKey, 
      interventionData.companyCode
    )
    
    if (existingMOV) {
      console.log('MOV already exists for intervention:', interventionKey)
      return existingMOV.id
    }

    // Extract facilitator information
    let facilitatorName = 'Unknown'
    let facilitatorId = ''
    
    if (facilitatorData) {
      facilitatorName = facilitatorData.name || facilitatorData.displayName || 'Unknown'
      facilitatorId = facilitatorData.id || ''
    } else if (interventionData.consultantIds && interventionData.consultantIds.length > 0) {
      // Try to fetch facilitator data
      try {
        const consultantDoc = await getDoc(
          doc(db, 'consultants', interventionData.consultantIds[0])
        )
        if (consultantDoc.exists()) {
          const consultantData = consultantDoc.data()
          facilitatorName = consultantData.name || consultantData.displayName || 'Unknown'
          facilitatorId = consultantDoc.id
        }
      } catch (error) {
        console.warn('Could not fetch facilitator data:', error)
      }
    }

    // Create MOV input from intervention and participant data
    const movInput: MOVCreationInput = {
      interventionKey,
      participantId: interventionData.participantId,
      beneficiaryName: participantData.beneficiaryName || participantData.companyName || '',
      interventionTitle: interventionData.interventionTitle,
      interventionType: interventionData.interventionType || 'Support',
      interventionDate: interventionData.confirmedAt?.toDate ? 
        interventionData.confirmedAt.toDate() : 
        new Date(interventionData.confirmedAt),
      facilitatorName,
      facilitatorId,
      companyCode: interventionData.companyCode,
      
      // Optional SMME information from participant data
      smmeNo: participantData.smmeNo,
      smmeSector: participantData.sector || participantData.industry,
      groupStage: participantData.groupStage || 'A',
      
      // Intervention method - can be enhanced based on available data
      interventionMethod: 'In-person', // Default for now
      frequencyOfIntervention: undefined // Can be enhanced later
    }

    // Validate the input
    if (!validateMOVData(movInput)) {
      console.error('MOV data validation failed for intervention:', interventionKey)
      return null
    }

    // Generate the MOV document
    const movId = await generateMOVDocument(movInput)
    
    console.log('MOV auto-generated successfully:', {
      interventionKey,
      movId,
      participantName: movInput.beneficiaryName
    })
    
    return movId

  } catch (error) {
    console.error('Error auto-generating MOV from intervention:', error)
    return null
  }
}

/**
 * Utility function to retroactively generate MOV documents for existing interventions
 * This can be used to generate MOV documents for interventions that were completed before MOV integration
 */
export const generateMOVForExistingInterventions = async (
  companyCode: string,
  limitToParticipant?: string
): Promise<{ generated: number; skipped: number; errors: number }> => {
  const results = { generated: 0, skipped: 0, errors: 0 }
  
  try {
    console.log('Starting retroactive MOV generation for company:', companyCode)
    
    // Build query for interventions database
    let interventionQuery = query(
      collection(db, 'interventionsDatabase'),
      where('companyCode', '==', companyCode)
    )
    
    // If limiting to specific participant, add that filter
    if (limitToParticipant) {
      interventionQuery = query(
        collection(db, 'interventionsDatabase'),
        where('companyCode', '==', companyCode),
        where('participantId', '==', limitToParticipant)
      )
    }

    const interventionSnapshot = await getDocs(interventionQuery)
    
    console.log(`Found ${interventionSnapshot.docs.length} interventions to process`)
    
    for (const interventionDoc of interventionSnapshot.docs) {
      const interventionData = interventionDoc.data()
      
      // Add detailed logging for debugging
      console.log('Processing intervention:', {
        id: interventionDoc.id,
        interventionKey: interventionData.interventionKey,
        participantId: interventionData.participantId,
        beneficiaryName: interventionData.beneficiaryName,
        interventionTitle: interventionData.interventionTitle,
        consultantIds: interventionData.consultantIds,
        confirmedAt: interventionData.confirmedAt,
        companyCode: interventionData.companyCode,
        canGenerate: canGenerateMOV(interventionData)
      })
      
      try {
        // Check if intervention has required fields for MOV generation
        if (!canGenerateMOV(interventionData)) {
          console.warn('Intervention missing required fields for MOV generation:', {
            interventionKey: interventionData.interventionKey,
            missingFields: {
              interventionKey: !interventionData.interventionKey,
              participantId: !interventionData.participantId,
              beneficiaryName: !interventionData.beneficiaryName,
              interventionTitle: !interventionData.interventionTitle,
              consultantIds: !interventionData.consultantIds?.length,
              confirmedAt: !interventionData.confirmedAt,
              companyCode: !interventionData.companyCode
            }
          })
          results.errors++
          continue
        }
        
        // Check if MOV already exists for this intervention
        const existingMOV = await getMOVByInterventionKey(
          interventionData.interventionKey,
          companyCode
        )
        
        if (existingMOV) {
          console.log('MOV already exists for intervention:', interventionData.interventionKey)
          results.skipped++
          continue
        }

        // Get participant data
        const participantDoc = await getDoc(
          doc(db, 'participants', interventionData.participantId)
        )
        
        if (!participantDoc.exists()) {
          console.warn('Participant not found for intervention:', interventionData.interventionKey)
          results.errors++
          continue
        }

        const participantData = participantDoc.data()

        // Generate MOV document
        const movId = await autoGenerateMOVFromIntervention(
          interventionData.interventionKey,
          interventionData,
          participantData
        )

        if (movId) {
          console.log('Generated MOV for intervention:', interventionData.interventionKey, '-> MOV ID:', movId)
          results.generated++
        } else {
          console.warn('Failed to generate MOV for intervention:', interventionData.interventionKey)
          results.errors++
        }

      } catch (error) {
        console.error('Error processing intervention:', interventionData.interventionKey, error)
        results.errors++
      }
    }

    console.log('Retroactive MOV generation complete:', results)
    return results

  } catch (error) {
    console.error('Error in retroactive MOV generation:', error)
    throw error
  }
}



// Export collection reference for direct use if needed
export { MOV_COLLECTION } 