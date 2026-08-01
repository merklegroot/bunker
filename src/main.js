import './style.css';
import { Game } from './Game.js';

const canvas = document.getElementById('scene');
const game = new Game(canvas);
window.__game = game;
