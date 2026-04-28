import { Upload } from 'lucide-react'
import { useMemo, useState } from 'react'

export function FileDropInput({
  accept,
  multiple,
  required,
  onSelect,
  hint,
}: {
  accept?: string
  multiple?: boolean
  required?: boolean
  onSelect: (files: File[]) => void
  hint?: string
}) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedNames, setSelectedNames] = useState<string[]>([])

  const summary = useMemo(() => {
    if (!selectedNames.length) {
      return hint ?? 'Drag and drop files here, or click to choose'
    }
    if (selectedNames.length === 1) {
      return selectedNames[0]
    }
    return `${selectedNames.length} files selected`
  }, [hint, selectedNames])

  const handleFiles = (files: File[]) => {
    setSelectedNames(files.map((file) => file.name))
    onSelect(files)
  }

  return (
    <label className={`file-dropzone ${dragOver ? 'drag-over' : ''}`}>
      <input
        accept={accept}
        className="file-dropzone-input"
        multiple={multiple}
        onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
        required={required}
        type="file"
      />
      <span className="file-dropzone-content">
        <Upload aria-hidden="true" size={16} />
        <span>{summary}</span>
      </span>
      <span
        className="file-dropzone-overlay"
        onDragEnter={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(event) => {
          event.preventDefault()
          if (!dragOver) {
            setDragOver(true)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          handleFiles(Array.from(event.dataTransfer.files ?? []))
        }}
      />
    </label>
  )
}
