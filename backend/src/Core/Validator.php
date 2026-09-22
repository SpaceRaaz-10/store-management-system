<?php
namespace App\Core;

class Validator
{
    private array $data;
    private array $errors = [];

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    public function required(string $field, ?string $label = null): self
    {
        $label = $label ?? ucfirst(str_replace('_', ' ', $field));
        $v = $this->data[$field] ?? null;
        if ($v === null || (is_string($v) && trim($v) === '')) {
            $this->errors[$field][] = "$label is required";
        }
        return $this;
    }

    public function max(string $field, int $len, ?string $label = null): self
    {
        $label = $label ?? ucfirst(str_replace('_', ' ', $field));
        $v = $this->data[$field] ?? null;
        if (is_string($v) && mb_strlen($v) > $len) {
            $this->errors[$field][] = "$label must be at most $len characters";
        }
        return $this;
    }

    public function min(string $field, int $len, ?string $label = null): self
    {
        $label = $label ?? ucfirst(str_replace('_', ' ', $field));
        $v = $this->data[$field] ?? null;
        if (is_string($v) && $v !== '' && mb_strlen($v) < $len) {
            $this->errors[$field][] = "$label must be at least $len characters";
        }
        return $this;
    }

    public function numeric(string $field, ?string $label = null): self
    {
        $label = $label ?? ucfirst(str_replace('_', ' ', $field));
        $v = $this->data[$field] ?? null;
        if ($v !== null && $v !== '' && !is_numeric($v)) {
            $this->errors[$field][] = "$label must be a number";
        }
        return $this;
    }

    public function minValue(string $field, float $min, ?string $label = null): self
    {
        $label = $label ?? ucfirst(str_replace('_', ' ', $field));
        $v = $this->data[$field] ?? null;
        if ($v !== null && $v !== '' && is_numeric($v) && (float)$v < $min) {
            $this->errors[$field][] = "$label must be at least $min";
        }
        return $this;
    }

    public function in(string $field, array $allowed, ?string $label = null): self
    {
        $label = $label ?? ucfirst(str_replace('_', ' ', $field));
        $v = $this->data[$field] ?? null;
        if ($v !== null && $v !== '' && !in_array($v, $allowed, true)) {
            $this->errors[$field][] = "$label must be one of: " . implode(', ', $allowed);
        }
        return $this;
    }

    public function add(string $field, string $message): self
    {
        $this->errors[$field][] = $message;
        return $this;
    }

    public function fails(): bool
    {
        return !empty($this->errors);
    }

    public function errors(): array
    {
        return $this->errors;
    }
}