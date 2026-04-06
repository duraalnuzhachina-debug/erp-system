Imports System
Imports System.Collections.Generic
Imports System.Text

Public Class CSVExporter
    ''' <summary>
    ''' Export data to HTML-based Excel file (.xls) with UTF-8 encoding
    ''' </summary>
    ''' <param name="filePath">File path to save</param>
    ''' <param name="headers">Column headers</param>
    ''' <param name="data">Data rows to export</param>
    Public Shared Sub ExportToCsv(filePath As String, headers As List(Of String), data As List(Of List(Of String)))
        Try
            Using writer As New StreamWriter(filePath, False, New UTF8Encoding(True))
                ' HTML Header with UTF-8 declaration
                writer.WriteLine("<!DOCTYPE html>")
                writer.WriteLine("<html>")
                writer.WriteLine("<head>")
                writer.WriteLine("<meta charset=""UTF-8"">")
                writer.WriteLine("<meta http-equiv=""Content-Type"" content=""text/html; charset=UTF-8"">")
                writer.WriteLine("<title>Export Data</title>")
                writer.WriteLine("<style>")
                writer.WriteLine("body { font-family: Arial, sans-serif; }")
                writer.WriteLine("table { border-collapse: collapse; width: 100%; margin: 10px; }")
                writer.WriteLine("th, td { border: 1px solid #333; padding: 10px; text-align: center; }")
                writer.WriteLine("th { background-color: #d3d3d3; font-weight: bold; }")
                writer.WriteLine("</style>")
                writer.WriteLine("</head>")
                writer.WriteLine("<body>")
                
                ' Write table
                writer.WriteLine("<table>")
                
                ' Write headers
                writer.WriteLine("<tr>")
                For Each header In headers
                    writer.WriteLine("<th>" & EscapeHtml(header) & "</th>")
                Next
                writer.WriteLine("</tr>")
                
                ' Write data rows
                If data IsNot Nothing Then
                    For Each row In data
                        If row IsNot Nothing Then
                            writer.WriteLine("<tr>")
                            For Each cell In row
                                Dim safeCell = If(cell, "")
                                writer.WriteLine("<td>" & EscapeHtml(safeCell) & "</td>")
                            Next
                            writer.WriteLine("</tr>")
                        End If
                    Next
                End If
                
                writer.WriteLine("</table>")
                writer.WriteLine("</body>")
                writer.WriteLine("</html>")
            End Using
        Catch ex As Exception
            Throw New Exception("Error exporting HTML file: " & ex.Message, ex)
        End Try
    End Sub

    ''' <summary>
    ''' Export DataTable to HTML-based Excel file (.xls)
    ''' </summary>
    Public Shared Sub ExportDataTableToCsv(filePath As String, table As Object)
        Try
            Using writer As New StreamWriter(filePath, False, New UTF8Encoding(True))
                ' HTML Header
                writer.WriteLine("<!DOCTYPE html>")
                writer.WriteLine("<html>")
                writer.WriteLine("<head>")
                writer.WriteLine("<meta charset=""UTF-8"">")
                writer.WriteLine("<meta http-equiv=""Content-Type"" content=""text/html; charset=UTF-8"">")
                writer.WriteLine("<title>Export Data</title>")
                writer.WriteLine("<style>")
                writer.WriteLine("body { font-family: Arial, sans-serif; }")
                writer.WriteLine("table { border-collapse: collapse; width: 100%; margin: 10px; }")
                writer.WriteLine("th, td { border: 1px solid #333; padding: 10px; text-align: center; }")
                writer.WriteLine("th { background-color: #d3d3d3; font-weight: bold; }")
                writer.WriteLine("</style>")
                writer.WriteLine("</head>")
                writer.WriteLine("<body>")
                
                ' Write table
                writer.WriteLine("<table>")
                
                ' Write headers
                writer.WriteLine("<tr>")
                For Each column In table.Columns
                    writer.WriteLine("<th>" & EscapeHtml(column.ColumnName) & "</th>")
                Next
                writer.WriteLine("</tr>")
                
                ' Write data rows
                For Each row In table.Rows
                    writer.WriteLine("<tr>")
                    For Each column In table.Columns
                        Dim value = If(row(column) Is Nothing, "", row(column).ToString())
                        writer.WriteLine("<td>" & EscapeHtml(value) & "</td>")
                    Next
                    writer.WriteLine("</tr>")
                Next
                
                writer.WriteLine("</table>")
                writer.WriteLine("</body>")
                writer.WriteLine("</html>")
            End Using
        Catch ex As Exception
            Throw New Exception("Error exporting HTML file: " & ex.Message, ex)
        End Try
    End Sub

    ''' <summary>
    ''' Escape HTML special characters to prevent injection
    ''' </summary>
    Private Shared Function EscapeHtml(text As String) As String
        If String.IsNullOrEmpty(text) Then
            Return ""
        End If
        Return text.Replace("&", "&amp;") _
                   .Replace("<", "&lt;") _
                   .Replace(">", "&gt;") _
                   .Replace("""", "&quot;") _
                   .Replace("'", "&#39;")
    End Function
End Class
