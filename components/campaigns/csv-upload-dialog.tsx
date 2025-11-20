"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Upload, File, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface CsvUploadDialogProps {
  open: boolean
  onClose: (saved: boolean) => void
  campaignId: string
  campaignName: string | null
}

export function CsvUploadDialog({ open, onClose, campaignId, campaignName }: CsvUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Please select a CSV file")
        return
      }
      setFile(selectedFile)
      setPreview(selectedFile.name)
      setUploadResult(null)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const droppedFile = event.dataTransfer.files[0]
    if (droppedFile) {
      if (!droppedFile.name.endsWith(".csv")) {
        toast.error("Please drop a CSV file")
        return
      }
      setFile(droppedFile)
      setPreview(droppedFile.name)
      setUploadResult(null)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a CSV file")
      return
    }

    setUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`/api/campaigns/${campaignId}/upload-csv`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload CSV")
      }

      setUploadResult(data)
      toast.success(data.message || "CSV uploaded successfully!")
      
      // Reset form after successful upload
      setTimeout(() => {
        setFile(null)
        setPreview(null)
        setUploadResult(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }, 2000)
    } catch (error: any) {
      toast.error(error.message || "Failed to upload CSV")
      setUploadResult({
        success: false,
        error: error.message
      })
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setFile(null)
      setPreview(null)
      setUploadResult(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      onClose(uploadResult?.success || false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload CSV to Campaign</DialogTitle>
          <DialogDescription>
            Upload a CSV file to add contacts and schedule calls for{" "}
            <strong>{campaignName || campaignId}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* CSV Format Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">CSV Format Requirements:</h4>
            <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
              <li>• Required columns: <strong>Name</strong> (or name), <strong>Phone</strong> (or phone)</li>
              <li>• Optional columns: <strong>Address</strong> (or address)</li>
              <li>• Column names are case-insensitive</li>
              <li>• Phone numbers will be automatically formatted</li>
            </ul>
          </div>

          {/* File Upload Area */}
          {!uploadResult && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {preview ? (
                <div className="flex flex-col items-center gap-2">
                  <File className="h-12 w-12 text-gray-400" />
                  <div>
                    <p className="font-medium">{preview}</p>
                    <p className="text-sm text-gray-500">Click to select a different file</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-12 w-12 text-gray-400" />
                  <div>
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-gray-500">CSV file only</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Result */}
          {uploadResult && (
            <div className={`p-4 rounded-lg ${
              uploadResult.success
                ? "bg-green-50 dark:bg-green-900/20"
                : "bg-red-50 dark:bg-red-900/20"
            }`}>
              {uploadResult.success ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-800 dark:text-green-200">
                      Upload Successful!
                    </h4>
                    <div className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-300">
                      <p>• Total contacts: {uploadResult.totalContacts}</p>
                      <p>• Calls created: {uploadResult.createdCalls}</p>
                      {uploadResult.errors && uploadResult.errors.length > 0 && (
                        <p className="text-yellow-700 dark:text-yellow-300">
                          • Errors: {uploadResult.errors.length} contacts failed
                        </p>
                      )}
                    </div>
                    {uploadResult.errors && uploadResult.errors.length > 0 && (
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        {uploadResult.errors.map((error: any, index: number) => (
                          <p key={index} className="text-xs text-red-600">
                            {error.contact}: {error.error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-800 dark:text-red-200">
                      Upload Failed
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {uploadResult.error || "An error occurred while uploading the file"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            {uploadResult?.success ? "Close" : "Cancel"}
          </Button>
          {!uploadResult && (
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}




