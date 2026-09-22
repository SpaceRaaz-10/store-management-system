<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\ProductRepository;

class ProductImageController
{
    private ProductRepository $repo;
    private const MAX_BYTES = 2097152; // 2 MB
    private const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new ProductRepository();
    }

    public function upload(string $id): void
    {
        $pid = (int)$id;
        $product = $this->repo->findById($pid);
        if (!$product) Response::error('Product not found', 404);

        if (empty($_FILES['image'])) Response::error('No file uploaded', 422);

        $file = $_FILES['image'];
        if ($file['error'] !== UPLOAD_ERR_OK) Response::error('Upload failed (code ' . $file['error'] . ')', 422);
        if ($file['size'] > self::MAX_BYTES) Response::error('File too large (max 2 MB)', 422);

        $mime = mime_content_type($file['tmp_name']);
        if (!in_array($mime, self::ALLOWED_MIME, true)) {
            Response::error('Invalid file type. Allowed: jpg, png, webp', 422);
        }

        $ext = match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
        };
        $filename = 'product_' . $pid . '_' . bin2hex(random_bytes(8)) . '.' . $ext;

        $appCfg = require __DIR__ . '/../../config/app.php';
        $dir = __DIR__ . '/../../' . $appCfg['upload_dir'];
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $dest = $dir . '/' . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            Response::error('Failed to save file', 500);
        }

        // Delete old image if any
        if (!empty($product['image_path'])) {
            $old = $dir . '/' . basename($product['image_path']);
            if (is_file($old)) @unlink($old);
        }

        $publicPath = '/uploads/products/' . $filename;
        $stmt = Database::pdo()->prepare('UPDATE products SET image_path = ? WHERE id = ?');
        $stmt->execute([$publicPath, $pid]);

        Response::ok(['image_path' => $publicPath], 'Image uploaded');
    }

    public function delete(string $id): void
    {
        $pid = (int)$id;
        $product = $this->repo->findById($pid);
        if (!$product) Response::error('Product not found', 404);
        if (empty($product['image_path'])) Response::error('No image to delete', 404);

        $appCfg = require __DIR__ . '/../../config/app.php';
        $dir = __DIR__ . '/../../' . $appCfg['upload_dir'];
        $path = $dir . '/' . basename($product['image_path']);
        if (is_file($path)) @unlink($path);

        $stmt = Database::pdo()->prepare('UPDATE products SET image_path = NULL WHERE id = ?');
        $stmt->execute([$pid]);

        Response::ok(null, 'Image deleted');
    }
}