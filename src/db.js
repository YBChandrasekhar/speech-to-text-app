import { supabase } from './supabaseClient'

// Store transcription with audio file
export async function storeTranscription(filename, transcript) {
  try {
    const { data, error } = await supabase
      .from('transcriptions')
      .insert({
        filename: filename,
        transcript: transcript,
        created_at: new Date().toISOString()
      })
      .select()

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error storing transcription:', error)
    return { success: false, error: error.message }
  }
}

// Get all transcriptions
export async function getTranscriptions() {
  try {
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching transcriptions:', error)
    return { success: false, error: error.message }
  }
}

// Delete transcription
export async function deleteTranscription(id) {
  try {
    const { error } = await supabase
      .from('transcriptions')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting transcription:', error)
    return { success: false, error: error.message }
  }
}
