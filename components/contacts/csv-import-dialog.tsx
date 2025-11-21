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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, File, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface CsvImportDialogProps {
  open: boolean
  onClose: (imported: boolean) => void
}

interface ColumnMapping {
  firstName: string
  lastName: string
  phone: string
  email: string
  address: string
}

export function CsvImportDialog({ open, onClose }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: ""
  })
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Parse CSV file and extract headers/preview
  const parseCSVFile = async (file: File) => {
    return new Promise<{ headers: string[]; preview: string[][] }>((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const lines = text.split(/\r?\n/).filter(line => line.trim())
          
          if (lines.length === 0) {
            reject(new Error("CSV file is empty"))
            return
          }

          // Parse CSV line (handles quoted values)
          const parseCSVLine = (line: string): string[] => {
            const result: string[] = []
            let current = ""
            let inQuotes = false

            for (let i = 0; i < line.length; i++) {
              const char = line[i]
              const nextChar = line[i + 1]

              if (char === '"') {
                if (inQuotes && nextChar === '"') {
                  current += '"'
                  i++
                } else {
                  inQuotes = !inQuotes
                }
              } else if (char === "," && !inQuotes) {
                result.push(current.trim())
                current = ""
              } else {
                current += char
              }
            }
            result.push(current.trim())
            return result
          }

          // Parse header
          const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim())
          
          // Parse preview rows (first 5 rows)
          const preview: string[][] = []
          for (let i = 1; i < Math.min(lines.length, 6); i++) {
            preview.push(parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, "").trim()))
          }

          resolve({ headers, preview })
        } catch (error: any) {
          reject(new Error(`Failed to parse CSV: ${error.message}`))
        }
      }

      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsText(file)
    })
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Please select a CSV file")
        return
      }
      
      try {
        const { headers, preview } = await parseCSVFile(selectedFile)
        setFile(selectedFile)
        setCsvHeaders(headers)
        setCsvPreview(preview)
        setImportResult(null)
        
        // Auto-detect column mappings
        const autoMapping: ColumnMapping = {
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          address: ""
        }

        headers.forEach((header, index) => {
          const lowerHeader = header.toLowerCase()
          if (/^first.*name|^fname|^first$/i.test(lowerHeader) && !autoMapping.firstName) {
            autoMapping.firstName = header
          } else if (/^last.*name|^lname|^last$/i.test(lowerHeader) && !autoMapping.lastName) {
            autoMapping.lastName = header
          } else if (/^name$|^full.*name|^fullname$/i.test(lowerHeader) && !autoMapping.firstName) {
            autoMapping.firstName = header
          } else if (/phone|mobile|cell|tel/i.test(lowerHeader) && !autoMapping.phone) {
            autoMapping.phone = header
          } else if (/email|e-mail|mail/i.test(lowerHeader) && !autoMapping.email) {
            autoMapping.email = header
          } else if (/address|street|location|city|zip|postal/i.test(lowerHeader) && !autoMapping.address) {
            autoMapping.address = header
          }
        })

        setMapping(autoMapping)
      } catch (error: any) {
        toast.error(error.message || "Failed to parse CSV file")
      }
    }
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const droppedFile = event.dataTransfer.files[0]
    if (droppedFile) {
      if (!droppedFile.name.endsWith(".csv")) {
        toast.error("Please drop a CSV file")
        return
      }
      
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".csv"
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(droppedFile)
      input.files = dataTransfer.files
      await handleFileSelect({ target: input } as any)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a CSV file")
      return
    }

    if (!mapping.phone) {
      toast.error("Please map the Phone column (required)")
      return
    }

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mapping", JSON.stringify(mapping))

      const response = await fetch("/api/contacts/import-csv", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to import CSV")
      }

      setImportResult(data)
      toast.success(data.message || `Successfully imported ${data.imported || 0} contacts!`)
      
      // Reset form after successful import
      setTimeout(() => {
        setFile(null)
        setCsvHeaders([])
        setCsvPreview([])
        setMapping({
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          address: ""
        })
        setImportResult(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }, 3000)
    } catch (error: any) {
      toast.error(error.message || "Failed to import CSV")
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    if (!importing) {
      setFile(null)
      setCsvHeaders([])
      setCsvPreview([])
      setMapping({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        address: ""
      })
      setImportResult(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      onClose(!!importResult)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file and map columns to contact fields
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          {!file && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <Label htmlFor="csv-file" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-700 font-medium">
                  Click to upload
                </span>{" "}
                or drag and drop
              </Label>
              <Input
                id="csv-file"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <p className="text-sm text-gray-500 mt-2">CSV files only</p>
            </div>
          )}

          {/* File Selected */}
          {file && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-3">
                  <File className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {csvHeaders.length} columns, {csvPreview.length} preview rows
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null)
                    setCsvHeaders([])
                    setCsvPreview([])
                    setMapping({
                      firstName: "",
                      lastName: "",
                      phone: "",
                      email: "",
                      address: ""
                    })
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ""
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Column Mapping Section */}
              {csvHeaders.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Map CSV Columns to Contact Fields</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="map-firstName">First Name</Label>
                        <Select
                          value={mapping.firstName || "none"}
                          onValueChange={(value) => setMapping({ ...mapping, firstName: value === "none" ? "" : value })}
                        >
                          <SelectTrigger id="map-firstName">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="map-lastName">Last Name</Label>
                        <Select
                          value={mapping.lastName || "none"}
                          onValueChange={(value) => setMapping({ ...mapping, lastName: value === "none" ? "" : value })}
                        >
                          <SelectTrigger id="map-lastName">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="map-phone" className="flex items-center gap-1">
                          Phone <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={mapping.phone}
                          onValueChange={(value) => setMapping({ ...mapping, phone: value })}
                        >
                          <SelectTrigger id="map-phone">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="map-email">Email</Label>
                        <Select
                          value={mapping.email || "none"}
                          onValueChange={(value) => setMapping({ ...mapping, email: value === "none" ? "" : value })}
                        >
                          <SelectTrigger id="map-email">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="map-address">Address</Label>
                        <Select
                          value={mapping.address || "none"}
                          onValueChange={(value) => setMapping({ ...mapping, address: value === "none" ? "" : value })}
                        >
                          <SelectTrigger id="map-address">
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Preview Table */}
                  {csvPreview.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Preview</h3>
                      <div className="border rounded-lg overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {csvHeaders.map((header) => (
                                <TableHead key={header} className="min-w-[100px]">
                                  {header}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvPreview.map((row, idx) => (
                              <TableRow key={idx}>
                                {csvHeaders.map((header, colIdx) => (
                                  <TableCell key={colIdx} className="text-sm">
                                    {row[colIdx] || ""}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <p className="font-medium">{importResult.message}</p>
                  {importResult.imported !== undefined && (
                    <p className="text-sm">
                      {importResult.imported} contacts imported
                      {importResult.updated !== undefined && importResult.updated > 0 && (
                        <span>, {importResult.updated} updated</span>
                      )}
                      {importResult.errors !== undefined && importResult.errors > 0 && (
                        <span>, {importResult.errors} errors</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            {importResult ? "Close" : "Cancel"}
          </Button>
          {file && !importResult && (
            <Button onClick={handleImport} disabled={importing || !mapping.phone}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Contacts
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

