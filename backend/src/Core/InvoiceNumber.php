<?php
namespace App\Core;

class InvoiceNumber
{
    /**
     * Atomically generate the next invoice number inside an open transaction.
     * Format: PREFIX-YYYY-NNNNNN (e.g. PUR-2026-000001)
     */
    public static function next(\PDO $pdo, string $prefix, ?int $year = null): string
    {
        $year = $year ?? (int)date('Y');

        $stmt = $pdo->prepare(
            'SELECT id, last_number FROM invoice_sequences WHERE prefix = ? AND year = ? FOR UPDATE'
        );
        $stmt->execute([$prefix, $year]);
        $row = $stmt->fetch();

        if ($row) {
            $next = (int)$row['last_number'] + 1;
            $upd = $pdo->prepare('UPDATE invoice_sequences SET last_number = ? WHERE id = ?');
            $upd->execute([$next, $row['id']]);
        } else {
            $next = 1;
            $ins = $pdo->prepare('INSERT INTO invoice_sequences (prefix, year, last_number) VALUES (?, ?, 1)');
            $ins->execute([$prefix, $year]);
        }

        return sprintf('%s-%04d-%06d', strtoupper($prefix), $year, $next);
    }
}