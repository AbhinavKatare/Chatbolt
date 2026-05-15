import { PlaygroundMain } from '@/components/playground/PlaygroundMain'

export default function PlaygroundRunPage({ params }: { params: { id: string } }) {
  return <PlaygroundMain initialWorkflowId={params.id} />
}
