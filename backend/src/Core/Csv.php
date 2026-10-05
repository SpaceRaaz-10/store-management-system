<?php
namespace App\Core;

class Csv
{
    /**
     * Send a CSV download response and exit.
     * @param string $filename  e.g. "sales-report-2026-10-05.csv"
     * @param array  $headers   Column headers
     * @param array  $rows      Array of associative arrays (keys matching headers)
     */
    public static function download(string $filename, array $headers, array $rows): void
    {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        $out = fopen('php://output', 'w');

        // UTF-8 BOM so Excel opens it correctly
        fwrite($out, "\xEF\xBB\xBF");

        fputcsv($out, $headers);
        foreach ($rows as $row) {
            $line = [];
            foreach ($headers as $h) {
                $line[] = $row[$h] ?? '';
            }
            fputcsv($out, $line);
        }

        fclose($out);
        exit;
    }
}