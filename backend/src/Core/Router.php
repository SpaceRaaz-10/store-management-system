<?php
namespace App\Core;

class Router
{
    private array $routes = [];
    public function add(string $method, string $path, callable|array $handler): void {
        $this->routes[] = [strtoupper($method), $path, $handler];
    }
    public function get(string $p, callable|array $h): void    { $this->add('GET', $p, $h); }
    public function post(string $p, callable|array $h): void   { $this->add('POST', $p, $h); }
    public function put(string $p, callable|array $h): void    { $this->add('PUT', $p, $h); }
    public function patch(string $p, callable|array $h): void  { $this->add('PATCH', $p, $h); }
    public function delete(string $p, callable|array $h): void { $this->add('DELETE', $p, $h); }
    public function dispatch(string $method, string $path): void
    {
        foreach ($this->routes as [$m, $routePath, $handler]) {
            if ($m !== $method) continue;
            $pattern = '#^' . preg_replace('#\{[a-zA-Z_][a-zA-Z0-9_]*\}#', '([^/]+)', $routePath) . '$#';
            if (preg_match($pattern, $path, $matches)) {
                array_shift($matches);
                if (is_array($handler)) { [$class, $fn] = $handler; (new $class())->{$fn}(...$matches); }
                else { $handler(...$matches); }
                return;
            }
        }
        Response::error('Route not found', 404);
    }
}
