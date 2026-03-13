import OpenAIAssistantLayout from '@/views/assistants/openai/OpenAIAssistantLayout'

const AzureAssistantLayout = () => {
    return <OpenAIAssistantLayout providerType='AZURE' providerLabel='Azure' credentialNames={['azureOpenAIApi']} />
}

export default AzureAssistantLayout
