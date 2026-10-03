// Точка входа.
import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.__game = new Game();
  } catch (err) {
    console.error('Не удалось запустить игру:', err);
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#ffb020;font:16px monospace;text-align:center;padding:20px';
    d.textContent = 'Ошибка запуска: ' + err.message;
    document.body.appendChild(d);
  }
});
