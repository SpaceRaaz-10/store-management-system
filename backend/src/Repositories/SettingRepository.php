<?php
namespace App\Repositories;

use App\Core\Database;

class SettingRepository
{
    public function all(): array
    {
        $rows = Database::pdo()->query(
            'SELECT `key`, value, `type`, `group` FROM settings ORDER BY `group` ASC, `key` ASC'
        )->fetchAll();

        $out = [];
        foreach ($rows as $r) {
            $out[$r['key']] = [
                'value' => $r['value'],
                'type' => $r['type'],
                'group' => $r['group'],
            ];
        }
        return $out;
    }

    public function update(string $key, string $value, int $userId): void
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'INSERT INTO settings (`key`, value, updated_by) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by), updated_at = NOW()'
        );
        $stmt->execute([$key, $value, $userId]);
    }

    public function bulkUpdate(array $kv, int $userId): void
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO settings (`key`, value, updated_by) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by), updated_at = NOW()'
            );
            foreach ($kv as $key => $value) {
                $stmt->execute([$key, (string)$value, $userId]);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}