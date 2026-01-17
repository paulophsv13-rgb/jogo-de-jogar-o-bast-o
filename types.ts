
export interface Vector2D {
  x: number;
  y: number;
}

export interface GameObject {
  id: string;
  pos: Vector2D;
  size: Vector2D;
  vel: Vector2D;
  color: string;
}

export interface Box extends GameObject {
  health: number;
  maxHealth: number;
  rotation: number;
  rotationSpeed: number;
  points: number;
}

export enum PowerUpType {
  GROW = 'GROW',
  MULTIPLIER = 'MULTIPLIER',
  SUPER = 'SUPER'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface PowerUp extends GameObject {
  type: PowerUpType;
  rotation: number;
}

export interface Player extends GameObject {
  rotation: number;
  angularVelocity: number;
  isAiming: boolean;
  aimStart: Vector2D;
  aimCurrent: Vector2D;
  trail: Vector2D[];
  activePowerUps: {
    [key in PowerUpType]?: number; // duration remaining
  };
}

export interface Particle {
  id: string;
  pos: Vector2D;
  vel: Vector2D;
  size: number;
  color: string;
  life: number;
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER'
}
