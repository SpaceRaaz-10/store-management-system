<?php
namespace App\Core;

/**
 * Minimal XLSX writer — produces a real Microsoft Excel workbook (.xlsx)
 * that supports:
 *   - Multiple sheets
 *   - Bold/colored header row
 *   - Frozen header row
 *   - Autofilter on the header row
 *   - Proper numeric cells (users can SUM, add formulas, sort, filter)
 *   - Column widths
 *   - Totals row
 *
 * No external library required — uses the built-in ZipArchive extension.
 */
class Excel
{
    // Cell style indexes (see stylesXml())
    public const ST_DEFAULT       = 0;
    public const ST_TITLE         = 1;
    public const ST_SUBTITLE      = 2;
    public const ST_HEADER        = 3;
    public const ST_TEXT_LEFT     = 4;
    public const ST_TEXT_RIGHT    = 5;
    public const ST_TEXT_CENTER   = 6;
    public const ST_MONEY         = 7;
    public const ST_NUMBER        = 8;
    public const ST_INT           = 9;
    public const ST_TOTAL_TEXT    = 10;
    public const ST_TOTAL_MONEY   = 11;
    public const ST_LABEL         = 12;
    public const ST_VALUE         = 13;

    private array $sheets = [];
    private int $current = -1;

    // ------------------------------------------------------------------
    // Public helpers
    // ------------------------------------------------------------------

    /**
     * One-shot: build a single-sheet report and stream it as a download.
     *
     * @param string $filename   Download filename (with .xlsx)
     * @param string $title      Sheet title (also big bold top row)
     * @param array  $meta       ['Period' => '...', 'Grouped by' => '...']
     * @param array  $columns    [['key'=>'x','label'=>'X','align'=>'left','format'=>'money','width'=>14], ...]
     * @param array  $rows       Array of associative arrays
     * @param array  $totalsRow  Optional ['key' => value]
     */
    public static function download(
        string $filename,
        string $title,
        array $meta,
        array $columns,
        array $rows,
        array $totalsRow = []
    ): void {
        if (!class_exists('ZipArchive')) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'PHP Zip extension is required for Excel export']);
            exit;
        }

        $colCount = max(1, count($columns));

        $w = new self();
        $w->addSheet($title);

        // Column widths
        $widths = [];
        foreach ($columns as $c) {
            $widths[] = isset($c['width']) && $c['width'] > 0
                ? (float)$c['width']
                : self::guessWidth($c);
        }
        $w->setColumnWidths($widths);

        // Title row
        $titleRow = array_fill(0, $colCount, '');
        $titleRow[0] = ['v' => $title, 's' => self::ST_TITLE, 't' => 's'];
        $w->addRow($titleRow);

        // Subtitle
        $subRow = array_fill(0, $colCount, '');
        $subRow[0] = ['v' => 'Generated ' . date('Y-m-d H:i:s'), 's' => self::ST_SUBTITLE, 't' => 's'];
        $w->addRow($subRow);

        // Blank
        $w->addRow([]);

        // Meta rows
        foreach ($meta as $k => $v) {
            $metaRow = array_fill(0, $colCount, '');
            $metaRow[0] = ['v' => (string)$k, 's' => self::ST_LABEL, 't' => 's'];
            if ($colCount >= 2) {
                $metaRow[1] = ['v' => (string)$v, 's' => self::ST_VALUE, 't' => 's'];
            }
            $w->addRow($metaRow);
        }

        // Blank before header
        $w->addRow([]);

        // Header row
        $headerRow = [];
        foreach ($columns as $c) {
            $headerRow[] = ['v' => (string)$c['label'], 's' => self::ST_HEADER, 't' => 's'];
        }
        $w->addRow($headerRow);
        $headerRowNum = count($w->sheets[$w->current]['rows']); // 1-indexed

        // Data rows
        foreach ($rows as $r) {
            $row = [];
            foreach ($columns as $c) {
                $row[] = self::cellFromColumn($c, $r[$c['key']] ?? null);
            }
            $w->addRow($row);
        }

        // Totals row
        if (!empty($totalsRow)) {
            $row = [];
            foreach ($columns as $c) {
                $raw = $totalsRow[$c['key']] ?? '';
                $fmt = $c['format'] ?? 'text';
                if ($raw === '' || $raw === null) {
                    $row[] = ['v' => '', 's' => self::ST_TOTAL_TEXT];
                } elseif (in_array($fmt, ['money', 'number', 'int'], true) && is_numeric($raw)) {
                    $row[] = [
                        'v' => $fmt === 'money' ? (float)$raw : (float)$raw,
                        's' => $fmt === 'money' ? self::ST_TOTAL_MONEY : self::ST_TOTAL_TEXT,
                        't' => 'n',
                    ];
                } else {
                    $row[] = ['v' => (string)$raw, 's' => self::ST_TOTAL_TEXT, 't' => 's'];
                }
            }
            $w->addRow($row);
        }

        // Freeze below header row so scrolling keeps header visible
        $w->freezeTopRow($headerRowNum);

        // Autofilter on header + data rows (excluding totals)
        $lastCol = self::colLetter($colCount - 1);
        $dataStart = $headerRowNum;
        $dataEnd = $headerRowNum + count($rows);
        $w->setAutoFilter('A' . $dataStart . ':' . $lastCol . $dataEnd);

        $w->send($filename);
    }

    // ------------------------------------------------------------------
    // Low-level builder
    // ------------------------------------------------------------------

    public function addSheet(string $name): self
    {
        $safe = preg_replace('/[\\\\\/\?\*\[\]:]/', ' ', $name) ?: 'Sheet';
        $safe = mb_substr(trim($safe), 0, 31);
        $this->sheets[] = [
            'name' => $safe,
            'rows' => [],
            'widths' => [],
            'freeze' => 0,
            'autofilter' => null,
        ];
        $this->current = count($this->sheets) - 1;
        return $this;
    }

    public function setColumnWidths(array $widths): self
    {
        $this->sheets[$this->current]['widths'] = $widths;
        return $this;
    }

    public function freezeTopRow(int $rows = 1): self
    {
        $this->sheets[$this->current]['freeze'] = $rows;
        return $this;
    }

    public function setAutoFilter(string $ref): self
    {
        $this->sheets[$this->current]['autofilter'] = $ref;
        return $this;
    }

    public function addRow(array $cells): self
    {
        $this->sheets[$this->current]['rows'][] = $cells;
        return $this;
    }

    public function send(string $filename): void
    {
        $tmp = tempnam(sys_get_temp_dir(), 'xlsx_');
        $zip = new \ZipArchive();
        if ($zip->open($tmp, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Failed to create XLSX container']);
            exit;
        }

        $zip->addFromString('[Content_Types].xml', $this->contentTypesXml());
        $zip->addFromString('_rels/.rels', $this->relsXml());
        $zip->addFromString('xl/workbook.xml', $this->workbookXml());
        $zip->addFromString('xl/_rels/workbook.xml.rels', $this->workbookRelsXml());
        $zip->addFromString('xl/styles.xml', $this->stylesXml());

        foreach ($this->sheets as $i => $sheet) {
            $zip->addFromString(
                'xl/worksheets/sheet' . ($i + 1) . '.xml',
                $this->sheetXml($sheet)
            );
        }

        $zip->close();

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($tmp));
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        readfile($tmp);
        @unlink($tmp);
        exit;
    }

    // ------------------------------------------------------------------
    // Cell helpers
    // ------------------------------------------------------------------

    public static function colLetter(int $n): string
    {
        $s = '';
        while ($n >= 0) {
            $s = chr(65 + ($n % 26)) . $s;
            $n = intdiv($n, 26) - 1;
        }
        return $s;
    }

    private static function esc(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES | ENT_XML1 | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function num(float $n): string
    {
        if (is_nan($n) || is_infinite($n)) return '0';
        $s = sprintf('%.10F', $n);
        $s = rtrim($s, '0');
        $s = rtrim($s, '.');
        return ($s === '' || $s === '-') ? '0' : $s;
    }

    private static function cellFromColumn(array $c, $raw): array
    {
        $fmt = $c['format'] ?? 'text';
        $align = $c['align'] ?? 'left';

        if ($raw === null || $raw === '') {
            $s = match ($fmt) {
                'money' => self::ST_MONEY,
                'number' => self::ST_NUMBER,
                'int' => self::ST_INT,
                default => match ($align) {
                    'right' => self::ST_TEXT_RIGHT,
                    'center' => self::ST_TEXT_CENTER,
                    default => self::ST_TEXT_LEFT,
                },
            };
            return ['v' => '', 's' => $s];
        }

        if ($fmt === 'money' && is_numeric($raw)) return ['v' => (float)$raw, 's' => self::ST_MONEY, 't' => 'n'];
        if ($fmt === 'number' && is_numeric($raw)) return ['v' => (float)$raw, 's' => self::ST_NUMBER, 't' => 'n'];
        if ($fmt === 'int' && is_numeric($raw)) return ['v' => (int)$raw, 's' => self::ST_INT, 't' => 'n'];

        $s = match ($align) {
            'right' => self::ST_TEXT_RIGHT,
            'center' => self::ST_TEXT_CENTER,
            default => self::ST_TEXT_LEFT,
        };
        return ['v' => (string)$raw, 's' => $s, 't' => 's'];
    }

    private static function guessWidth(array $c): float
    {
        $fmt = $c['format'] ?? 'text';
        if ($fmt === 'money') return 14.0;
        if ($fmt === 'number') return 11.0;
        if ($fmt === 'int') return 9.0;
        $len = mb_strlen($c['label'] ?? 'Column');
        $w = $len * 1.35 + 4.0;
        return max(10.0, min(40.0, $w));
    }

    // ------------------------------------------------------------------
    // XML parts
    // ------------------------------------------------------------------

    private function contentTypesXml(): string
    {
        $overrides = '';
        foreach ($this->sheets as $i => $_s) {
            $n = $i + 1;
            $overrides .= '<Override PartName="/xl/worksheets/sheet' . $n . '.xml" '
                . 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            . $overrides
            . '</Types>';
    }

    private function relsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';
    }

    private function workbookXml(): string
    {
        $sheetsXml = '';
        foreach ($this->sheets as $i => $sheet) {
            $n = $i + 1;
            $sheetsXml .= '<sheet name="' . self::esc($sheet['name']) . '" sheetId="' . $n . '" r:id="rId' . $n . '"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets>' . $sheetsXml . '</sheets>'
            . '</workbook>';
    }

    private function workbookRelsXml(): string
    {
        $rels = '';
        $i = 1;
        foreach ($this->sheets as $_s) {
            $rels .= '<Relationship Id="rId' . $i . '" '
                . 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
                . 'Target="worksheets/sheet' . $i . '.xml"/>';
            $i++;
        }
        $rels .= '<Relationship Id="rIdStyles" '
            . 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
            . 'Target="styles.xml"/>';

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . $rels
            . '</Relationships>';
    }

    private function stylesXml(): string
    {
        // 14 styles, indexes 0..13 matching the ST_* constants
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'

            . '<numFmts count="2">'
            . '<numFmt numFmtId="164" formatCode="#,##0.00"/>'
            . '<numFmt numFmtId="165" formatCode="#,##0.###"/>'
            . '</numFmts>'

            . '<fonts count="5">'
            // 0 — default
            . '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>'
            // 1 — bold
            . '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>'
            // 2 — bold white
            . '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>'
            // 3 — title (bold size 14)
            . '<font><b/><sz val="14"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>'
            // 4 — subtitle (italic grey)
            . '<font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>'
            . '</fonts>'

            . '<fills count="4">'
            // 0 — none (required)
            . '<fill><patternFill patternType="none"/></fill>'
            // 1 — gray125 (required)
            . '<fill><patternFill patternType="gray125"/></fill>'
            // 2 — blue header
            . '<fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>'
            // 3 — light indigo (totals)
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/><bgColor indexed="64"/></patternFill></fill>'
            . '</fills>'

            . '<borders count="2">'
            // 0 — none
            . '<border><left/><right/><top/><bottom/><diagonal/></border>'
            // 1 — thin all around
            . '<border>'
            . '<left style="thin"><color rgb="FFCBD5E1"/></left>'
            . '<right style="thin"><color rgb="FFCBD5E1"/></right>'
            . '<top style="thin"><color rgb="FFCBD5E1"/></top>'
            . '<bottom style="thin"><color rgb="FFCBD5E1"/></bottom>'
            . '<diagonal/>'
            . '</border>'
            . '</borders>'

            . '<cellStyleXfs count="1">'
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'
            . '</cellStyleXfs>'

            . '<cellXfs count="14">'

            // 0 — default
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'

            // 1 — title
            . '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">'
            . '<alignment horizontal="left" vertical="center"/></xf>'

            // 2 — subtitle
            . '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">'
            . '<alignment horizontal="left" vertical="center"/></xf>'

            // 3 — header (bold white on blue, centered, wrapped)
            . '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" '
            . 'applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>'

            // 4 — text left (bordered)
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" '
            . 'applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="left" vertical="center"/></xf>'

            // 5 — text right (bordered)
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" '
            . 'applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="right" vertical="center"/></xf>'

            // 6 — text center (bordered)
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" '
            . 'applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="center" vertical="center"/></xf>'

            // 7 — money (bordered, #,##0.00)
            . '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" '
            . 'applyNumberFormat="1" applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="right" vertical="center"/></xf>'

            // 8 — number (bordered, #,##0.###)
            . '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" '
            . 'applyNumberFormat="1" applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="right" vertical="center"/></xf>'

            // 9 — int (bordered, right)
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" '
            . 'applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="right" vertical="center"/></xf>'

            // 10 — totals text (bold, indigo fill, bordered)
            . '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" '
            . 'applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="left" vertical="center"/></xf>'

            // 11 — totals money (bold, indigo fill, #,##0.00)
            . '<xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" '
            . 'applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="right" vertical="center"/></xf>'

            // 12 — meta label (bold, bordered)
            . '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" '
            . 'applyFont="1" applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="left" vertical="center"/></xf>'

            // 13 — meta value (bordered)
            . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" '
            . 'applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="left" vertical="center"/></xf>'

            . '</cellXfs>'
            . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            . '</styleSheet>';
    }

    private function sheetXml(array $sheet): string
    {
        $rows = $sheet['rows'];

        // Sheet views (freeze)
        $views = '';
        if (!empty($sheet['freeze']) && $sheet['freeze'] > 0) {
            $fy = (int)$sheet['freeze'];
            $topLeft = 'A' . ($fy + 1);
            $views = '<sheetViews><sheetView workbookViewId="0">'
                . '<pane ySplit="' . $fy . '" topLeftCell="' . $topLeft . '" activePane="bottomLeft" state="frozen"/>'
                . '<selection pane="bottomLeft" activeCell="' . $topLeft . '" sqref="' . $topLeft . '"/>'
                . '</sheetView></sheetViews>';
        } else {
            $views = '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
        }

        // Column widths
        $cols = '';
        if (!empty($sheet['widths'])) {
            $cols = '<cols>';
            foreach ($sheet['widths'] as $i => $w) {
                $cols .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" '
                    . 'width="' . self::num((float)$w) . '" customWidth="1"/>';
            }
            $cols .= '</cols>';
        }

        // Sheet data
        $sheetData = '';
        foreach ($rows as $ri => $row) {
            $rowNum = $ri + 1;
            if (empty($row)) {
                $sheetData .= '<row r="' . $rowNum . '"/>';
                continue;
            }
            $cells = '';
            foreach ($row as $ci => $cell) {
                $ref = self::colLetter($ci) . $rowNum;
                $cells .= $this->cellXml($ref, $cell);
            }
            $sheetData .= '<row r="' . $rowNum . '">' . $cells . '</row>';
        }

        // AutoFilter
        $auto = '';
        if (!empty($sheet['autofilter'])) {
            $auto = '<autoFilter ref="' . self::esc($sheet['autofilter']) . '"/>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . $views
            . '<sheetFormatPr defaultRowHeight="15"/>'
            . $cols
            . '<sheetData>' . $sheetData . '</sheetData>'
            . $auto
            . '</worksheet>';
    }

    private function cellXml(string $ref, $cell): string
    {
        if (is_array($cell)) {
            $v = $cell['v'] ?? '';
            $t = $cell['t'] ?? (is_int($v) || is_float($v) ? 'n' : 's');
            $s = $cell['s'] ?? self::ST_DEFAULT;
        } else {
            $v = $cell;
            $t = (is_int($v) || is_float($v)) ? 'n' : 's';
            $s = self::ST_DEFAULT;
        }

        if ($v === '' || $v === null) {
            return '<c r="' . $ref . '" s="' . (int)$s . '"/>';
        }

        if ($t === 'n' && is_numeric($v)) {
            return '<c r="' . $ref . '" s="' . (int)$s . '"><v>' . self::num((float)$v) . '</v></c>';
        }

        return '<c r="' . $ref . '" s="' . (int)$s . '" t="inlineStr">'
            . '<is><t xml:space="preserve">' . self::esc((string)$v) . '</t></is></c>';
    }
}