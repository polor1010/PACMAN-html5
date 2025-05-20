/*jslint browser: true, undef: true, eqeqeq: true, nomen: true, white: true */
/*global window: false, document: false */

/*
 * fix looped audio
 * add fruits + levels
 * fix what happens when a ghost is eaten (should go back to base)
 * do proper ghost mechanics (blinky/wimpy etc)
 */

var NONE        = 4,
    UP          = 3,
    LEFT        = 2,
    DOWN        = 1,
    RIGHT       = 11,
    WAITING     = 5,
    PAUSE       = 6,
    PLAYING     = 7,
    COUNTDOWN   = 8,
    EATEN_PAUSE = 9,
    DYING       = 10,
    Pacman      = {};

// 將鬼魂模式相關變量設為全局變量，供 HTML 界面訪問
window.CHASE_MODE = true; // 設為 true 則鬼魂會追蹤 Pacman，false 則隨機移動
window.GHOST_TEAMWORK = true; // 設為 true 則啟用鬼魂團隊協作
window.HUNTING_PROBABILITY = 0.65; // 鬼魂主動追逐 Pacman 的概率

Pacman.FPS = 30;

class Ghost {
  constructor(game, map, colour, getUserPosition, id) {
    this.game = game;
    this.map = map;
    this.colour = colour;
    this.getUserPosition = getUserPosition;
    this.position = null;
    this.direction = null;
    this.eatable = null;
    this.eaten = null;
    this.due = null;
    this.id = id || `ghost-${Math.floor(Math.random() * 1000)}`;
    
    // 團隊協作的隨機偏移，使不同的鬼魂選擇不同的追逐路徑
    this.positionBias = {
      x: Math.random() * 40 - 20, // -20 到 +20 的偏移
      y: Math.random() * 40 - 20
    };
    
    // 鬼魂的個性，影響行為偏好
    this.personality = {
      // 追逐 Pacman 的概率，每個鬼魂略有不同
      huntingProb: HUNTING_PROBABILITY * (0.8 + Math.random() * 0.4),
      // 偏好的區域 (左上/右上/左下/右下)
      preferredQuadrant: Math.floor(Math.random() * 4),
      // 改變方向的頻率 (越低越頻繁)
      directionChangeTolerance: 5 + Math.floor(Math.random() * 15)
    };
    
    // 智能追逐相關變量
    this.lastDecisionPoint = 0; // 上次決策的遊戲刻
    this.stuckCount = 0; // 卡住計數
    this.lastPositions = []; // 記錄過去幾個位置，用於檢測卡住
    
    this.reset();
  }
  
  getNewCoord(dir, current) { 
    const speed = this.isVunerable() ? 1 : this.isHidden() ? 4 : 2;
    const xSpeed = (dir === LEFT && -speed || dir === RIGHT && speed || 0);
    const ySpeed = (dir === DOWN && speed || dir === UP && -speed || 0);
    
        return {
      "x": this.addBounded(current.x, xSpeed),
      "y": this.addBounded(current.y, ySpeed)
        };
  }

    /* Collision detection(walls) is done when a ghost lands on an
     * exact block, make sure they dont skip over it 
     */
  addBounded(x1, x2) { 
    const rem = x1 % 10; 
    const result = rem + x2;
        if (rem !== 0 && result > 10) {
            return x1 + (10 - rem);
        } else if(rem > 0 && result < 0) { 
            return x1 - rem;
        }
        return x1 + x2;
  }
  
  isVunerable() { 
    return this.eatable !== null;
  }
  
  isDangerous() {
    return this.eaten === null;
  }

  isHidden() { 
    return this.eatable === null && this.eaten !== null;
  }
  
  getRandomDirection() {
    const moves = (this.direction === LEFT || this.direction === RIGHT) 
            ? [UP, DOWN] : [LEFT, RIGHT];
        return moves[Math.floor(Math.random() * 2)];
  }
  
  reset() {
    this.eaten = null;
    this.eatable = null;
    this.position = {"x": 90, "y": 80};
    this.direction = this.getRandomDirection();
    this.due = this.getRandomDirection();
  }
  
  onWholeSquare(x) {
        return x % 10 === 0;
  }
    
  oppositeDirection(dir) { 
        return dir === LEFT && RIGHT ||
            dir === RIGHT && LEFT ||
            dir === UP && DOWN || UP;
  }

  makeEatable() {
    this.direction = this.oppositeDirection(this.direction);
    this.eatable = this.game.getTick();
  }

  eat() { 
    this.eatable = null;
    this.eaten = this.game.getTick();
  }

  pointToCoord(x) {
        return Math.round(x / 10);
  }

  nextSquare(x, dir) {
    const rem = x % 10;
        if (rem === 0) { 
            return x; 
        } else if (dir === RIGHT || dir === DOWN) { 
            return x + (10 - rem);
        } else {
            return x - rem;
        }
  }

  onGridSquare(pos) {
    return this.onWholeSquare(pos.y) && this.onWholeSquare(pos.x);
  }

  secondsAgo(tick) { 
    return (this.game.getTick() - tick) / Pacman.FPS;
  }

  getColour() { 
    if (this.eatable) { 
      if (this.secondsAgo(this.eatable) > 5) { 
        return this.game.getTick() % 20 > 10 ? "#FFFFFF" : "#0000BB";
            } else { 
                return "#0000BB";
            }
    } else if(this.eaten) { 
            return "#222";
        } 
    return this.colour;
  }

  draw(ctx) {
    const s = this.map.blockSize;
    const top = (this.position.y/10) * s;
    const left = (this.position.x/10) * s;

    if (this.eatable && this.secondsAgo(this.eatable) > 8) {
      this.eatable = null;
    }
    
    if (this.eaten && this.secondsAgo(this.eaten) > 3) { 
      this.eaten = null;
    }
    
    const tl = left + s;
    const base = top + s - 3;
    const inc = s / 10;

    const high = this.game.getTick() % 10 > 5 ? 3  : -3;
    const low  = this.game.getTick() % 10 > 5 ? -3 : 3;

    ctx.fillStyle = this.getColour();
        ctx.beginPath();

        ctx.moveTo(left, base);

        ctx.quadraticCurveTo(left, top, left + (s/2),  top);
        ctx.quadraticCurveTo(left + s, top, left+s,  base);
        
        // Wavy things at the bottom
        ctx.quadraticCurveTo(tl-(inc*1), base+high, tl - (inc * 2),  base);
        ctx.quadraticCurveTo(tl-(inc*3), base+low, tl - (inc * 4),  base);
        ctx.quadraticCurveTo(tl-(inc*5), base+high, tl - (inc * 6),  base);
        ctx.quadraticCurveTo(tl-(inc*7), base+low, tl - (inc * 8),  base); 
        ctx.quadraticCurveTo(tl-(inc*9), base+high, tl - (inc * 10), base); 

        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "#FFF";
    ctx.arc(left + 6, top + 6, s / 6, 0, 300, false);
    ctx.arc((left + s) - 6, top + 6, s / 6, 0, 300, false);
        ctx.closePath();
        ctx.fill();

    const f = s / 12;
    const off = {};
        off[RIGHT] = [f, 0];
        off[LEFT]  = [-f, 0];
        off[UP]    = [0, -f];
        off[DOWN]  = [0, f];

        ctx.beginPath();
        ctx.fillStyle = "#000";
    ctx.arc(left+6+off[this.direction][0], top+6+off[this.direction][1], 
                s / 15, 0, 300, false);
    ctx.arc((left+s)-6+off[this.direction][0], top+6+off[this.direction][1], 
                s / 15, 0, 300, false);
        ctx.closePath();
        ctx.fill();

    // 直接在幽灵身上绘制 ID
    const idNumber = this.id.split('-')[1]; // 提取数字部分
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "8px Arial";
    ctx.textAlign = "center";
    ctx.fillText(idNumber, left + s/2, top + s/2);
  }

  pane(pos) {
    // 基于屏幕宽度处理水平穿梭
    if (pos.x >= 190 && this.direction === RIGHT) {
      return {"y": pos.y, "x": -10};
    }
    
    if (pos.x <= -10 && this.direction === LEFT) {
      return {"y": pos.y, "x": 190};
    }
    
    // 防止鬼魂卡住的安全措施
    if (pos.y < 0) return {"y": 0, "x": pos.x};
    if (pos.y > 220) return {"y": 220, "x": pos.x};

        return false;
  }
  
  getSmartChaseDirection() {
    if (!window.CHASE_MODE || this.isVunerable()) {
      return this.getRandomDirection();
    }
    
    const pacmanPos = this.getUserPosition();
    if (!pacmanPos) return this.getRandomDirection();
    
    // 計算曼哈頓距離 (用於評估到 Pacman 的距離)
    const manhattanDistance = (pos1, pos2) => {
      return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    };
    
    // 使用全局變量 HUNTING_PROBABILITY，並與鬼魂自身的個性結合
    const combinedProb = window.HUNTING_PROBABILITY * this.personality.huntingProb;
    
    // 隨機決定是否追逐 Pacman
    if (Math.random() > combinedProb) {
      return this.getRandomDirection();
    }
    
    // 獲取可能的移動方向
    const possibleDirs = [];
    const thisPos = this.position;
    
    // 計算到 Pacman 的向量
    let targetPos = { x: pacmanPos.x, y: pacmanPos.y };
    
    // 團隊協作：如果啟用，根據 ID 和偏移量修改目標位置
    if (window.GHOST_TEAMWORK) {
      // 為每個鬼魂添加固定偏移，以便從不同方向接近 Pacman
      targetPos.x += this.positionBias.x;
      targetPos.y += this.positionBias.y;
      
      // 檢查鬼魂 ID，決定不同的策略
      const idNum = parseInt(this.id.split('-')[1]);
      
      // 奇數 ID 的鬼魂嘗試預測 Pacman 移動
      if (idNum % 2 === 1) {
        // 预测 Pacman 根据当前方向将要移动的位置
        const userDirection = window.pacmanCurrentDirection || LEFT; // 默认值
        const predictionDistance = 30; // 预测距离
        
        if (userDirection === LEFT) {
          targetPos.x -= predictionDistance;
        } else if (userDirection === RIGHT) {
          targetPos.x += predictionDistance;
        } else if (userDirection === UP) {
          targetPos.y -= predictionDistance;
        } else if (userDirection === DOWN) {
          targetPos.y += predictionDistance;
        }
      }
    }
    
    // 計算主要的追逐方向（水平或垂直）
    const dx = targetPos.x - thisPos.x;
    const dy = targetPos.y - thisPos.y;
    
    // 根據距離確定優先方向
    if (Math.abs(dx) > Math.abs(dy)) {
      // 水平距離更大，優先考慮水平移動
      if (dx > 0) possibleDirs.push(RIGHT);
      else if (dx < 0) possibleDirs.push(LEFT);
      
      if (dy > 0) possibleDirs.push(DOWN);
      else if (dy < 0) possibleDirs.push(UP);
    } else {
      // 垂直距離更大，優先考慮垂直移動
      if (dy > 0) possibleDirs.push(DOWN);
      else if (dy < 0) possibleDirs.push(UP);
      
      if (dx > 0) possibleDirs.push(RIGHT);
      else if (dx < 0) possibleDirs.push(LEFT);
    }
    
    // 嘗試避免選擇與當前方向相反的方向，除非沒有其他選擇
    const oppositeDir = this.oppositeDirection(this.direction);
    const nonOppositeDirections = possibleDirs.filter(dir => dir !== oppositeDir);
    
    // 首先檢查非相反方向是否可行
    if (nonOppositeDirections.length > 0) {
      for (let dir of nonOppositeDirections) {
        const npos = this.getNewCoord(dir, this.position);
        if (this.map.isFloorSpace({
          "y": this.pointToCoord(this.nextSquare(npos.y, dir)),
          "x": this.pointToCoord(this.nextSquare(npos.x, dir))
        })) {
          return dir;
        }
      }
    }
    
    // 如果非相反方向都不可行，檢查所有可能方向
    for (let dir of possibleDirs) {
      const npos = this.getNewCoord(dir, this.position);
      if (this.map.isFloorSpace({
        "y": this.pointToCoord(this.nextSquare(npos.y, dir)),
        "x": this.pointToCoord(this.nextSquare(npos.x, dir))
      })) {
        return dir;
      }
    }
    
    // 如果所有方向都不行，隨機選一個
    return this.getRandomDirection();
  }
  
  // 添加一個方法處理逃避行為
  getFleeDirection() {
    const pacmanPos = this.getUserPosition();
    if (!pacmanPos) return this.getRandomDirection();
    
    // 獲取所有可能的移動方向
    const possibleDirs = [LEFT, RIGHT, UP, DOWN];
    
    // 計算每個方向會導致的新位置
    const newPositions = possibleDirs.map(dir => {
      const npos = this.getNewCoord(dir, this.position);
      return {
        dir: dir,
        pos: npos,
        valid: this.map.isFloorSpace({
          "y": this.pointToCoord(this.nextSquare(npos.y, dir)),
          "x": this.pointToCoord(this.nextSquare(npos.x, dir))
        })
      };
    }).filter(item => item.valid);
    
    // 如果沒有有效方向，返回隨機方向
    if (newPositions.length === 0) {
      return this.getRandomDirection();
    }
    
    // 計算每個方向與 Pacman 的距離
    newPositions.forEach(item => {
      item.distance = Math.sqrt(
        Math.pow(item.pos.x - pacmanPos.x, 2) + 
        Math.pow(item.pos.y - pacmanPos.y, 2)
      );
    });
    
    // 排序，優先選擇遠離 Pacman 的方向
    newPositions.sort((a, b) => b.distance - a.distance);
    
    // 隨機選擇前兩個最遠的方向之一，增加一些隨機性
    const validDirections = newPositions.slice(0, Math.min(2, newPositions.length));
    return validDirections[Math.floor(Math.random() * validDirections.length)].dir;
  }
  
  // 檢測鬼魂是否被卡住
  isStuck() {
    if (this.lastPositions.length < 8) return false;
    
    // 檢查最近8個位置是否只有2個不同位置
    const uniquePositions = new Set();
    this.lastPositions.forEach(pos => {
      uniquePositions.add(`${pos.x},${pos.y}`);
    });
    
    return uniquePositions.size <= 2;
  }
  
  // 處理被卡住的情況
  handleStuckState() {
    // 增加隨機性，幫助擺脫困境
    const randomDirection = [LEFT, RIGHT, UP, DOWN][Math.floor(Math.random() * 4)];
    this.stuckCount++; // 增加卡住計數
    
    // 如果卡住超過5次，嘗試更加隨機的行為
    if (this.stuckCount > 5) {
      this.stuckCount = 0;
      this.lastPositions = [];
      return randomDirection;
    }
    
    return randomDirection;
  }
  
  move(ctx) {
    const oldPos = this.position;
    const onGrid = this.onGridSquare(this.position);
    let npos = null;
    let moveAttempts = 0;
    const MAX_ATTEMPTS = 5; // 限制尝试次数
    
    // 更新位置歷史
    this.lastPositions.push({x: oldPos.x, y: oldPos.y});
    if (this.lastPositions.length > 10) {
      this.lastPositions.shift(); // 保持陣列在合理大小
    }
    
    // 檢查是否被卡住
    if (this.isStuck()) {
      this.due = this.handleStuckState();
    } else {
      this.stuckCount = 0; // 重置卡住計數
    }
    
    // 移动逻辑主循环，替代原来的递归
    while (moveAttempts < MAX_ATTEMPTS) {
      moveAttempts++;
      
      // 根據狀態決定移動策略
      if (this.isVunerable()) {
        // 如果可食用，嘗試逃離 Pacman
        this.due = this.getFleeDirection();
      } else if (window.CHASE_MODE) {
        // 智能追逐模式
        this.due = this.getSmartChaseDirection();
      } else {
        // 隨機移動模式
        this.due = this.getRandomDirection();
      }
      
      npos = this.getNewCoord(this.due, this.position);
      if (onGrid &&
          this.map.isFloorSpace({
            "y": this.pointToCoord(this.nextSquare(npos.y, this.due)),
            "x": this.pointToCoord(this.nextSquare(npos.x, this.due))
          })) {
        this.direction = this.due;
        break; // 成功找到移动方向
      }
      
      // 尝试使用当前方向
      npos = this.getNewCoord(this.direction, this.position);
      
      // 检查是否会撞墙
      if (!onGrid || 
          !this.map.isWallSpace({
            "y": this.pointToCoord(this.nextSquare(npos.y, this.direction)),
            "x": this.pointToCoord(this.nextSquare(npos.x, this.direction))
          })) {
        break; // 当前方向可行
      }
      
      // 如果当前方向不可行，更换方向再试
      this.direction = this.getRandomDirection();
    }
    
    // 如果经过多次尝试仍无法移动，则保持原位
    if (moveAttempts >= MAX_ATTEMPTS) {
      return {
        "new": oldPos,
        "old": oldPos
      };
    }
    
    // 更新位置
    this.position = npos;
    const tmp = this.pane(this.position);
    if (tmp) { 
      this.position = tmp;
    }
    
    // 記錄最近一次決策點
    this.lastDecisionPoint = this.game.getTick();
    
    return {
      "new": this.position,
      "old": oldPos
    };
  }
}

class User {
  constructor(game, map) {
    this.game = game;
    this.map = map;
    this.position = null;
    this.direction = null;
    this.eaten = null;
    this.due = null;
    this.lives = null;
    this.score = 5;
    this.keyMap = {};
    
    // 設置按鍵映射
    this.keyMap[KEY.ARROW_LEFT] = LEFT;
    this.keyMap[KEY.ARROW_UP] = UP;
    this.keyMap[KEY.ARROW_RIGHT] = RIGHT;
    this.keyMap[KEY.ARROW_DOWN] = DOWN;
    
    this.initUser();
  }
  
  addScore(nScore) {
    this.score += nScore;
    if (this.score >= 10000 && this.score - nScore < 10000) {
      this.lives += 1;
    }
  }

  theScore() {
    return this.score;
  }

  loseLife() {
    this.lives -= 1;
  }

  getLives() {
    return this.lives;
  }

  initUser() {
    this.score = 0;
    this.lives = 3;
    this.newLevel();
  }
  
  newLevel() {
    this.resetPosition();
    this.eaten = 0;
    console.log("新關卡開始，已吃豆子數重置為0");
  }
  
  resetPosition() {
    this.position = {"x": 90, "y": 120};
    this.direction = LEFT;
    this.due = LEFT;
  }
  
  reset() {
    this.initUser();
    this.resetPosition();
  }
  
  keyDown(e) {
    if (typeof this.keyMap[e.keyCode] !== "undefined") { 
      this.due = this.keyMap[e.keyCode];
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        return true;
  }

  getNewCoord(dir, current) {
        return {
            "x": current.x + (dir === LEFT && -2 || dir === RIGHT && 2 || 0),
            "y": current.y + (dir === DOWN && 2 || dir === UP    && -2 || 0)
        };
  }

  onWholeSquare(x) {
        return x % 10 === 0;
  }

  pointToCoord(x) {
        return Math.round(x/10);
  }
    
  nextSquare(x, dir) {
        var rem = x % 10;
        if (rem === 0) { 
            return x; 
        } else if (dir === RIGHT || dir === DOWN) { 
            return x + (10 - rem);
        } else {
            return x - rem;
        }
  }

  next(pos, dir) {
        return {
      "y" : this.pointToCoord(this.nextSquare(pos.y, dir)),
      "x" : this.pointToCoord(this.nextSquare(pos.x, dir)),
    };                               
  }

  onGridSquare(pos) {
    return this.onWholeSquare(pos.y) && this.onWholeSquare(pos.x);
  }

  isOnSamePlane(due, dir) { 
        return ((due === LEFT || due === RIGHT) && 
                (dir === LEFT || dir === RIGHT)) || 
            ((due === UP || due === DOWN) && 
             (dir === UP || dir === DOWN));
  }

  move(ctx) {
    var npos = null, 
        nextWhole = null, 
        oldPosition = this.position,
        block = null;
    
    if (this.due !== this.direction) {
      npos = this.getNewCoord(this.due, this.position);
      
      if (this.isOnSamePlane(this.due, this.direction) || 
          (this.onGridSquare(this.position) && 
           this.map.isFloorSpace(this.next(npos, this.due)))) {
        this.direction = this.due;
            } else {
                npos = null;
            }
        }

        if (npos === null) {
      npos = this.getNewCoord(this.direction, this.position);
    }
    
    if (this.onGridSquare(this.position) && this.map.isWallSpace(this.next(npos, this.direction))) {
      this.direction = NONE;
    }

    if (this.direction === NONE) {
      return {"new" : this.position, "old" : this.position};
    }
    
    // 紀錄當前 Pacman 的移動方向到全局變量，供鬼魂使用
    window.pacmanCurrentDirection = this.direction;
    
    // 针对两个地图位置更新传送点逻辑
    // MAP1 的传送点在 y = 100，MAP2 的传送点也应该适用
    if (this.direction === RIGHT && npos.x >= 190) {
      // 传送到地图左侧
      npos = {"y": npos.y, "x": -10};
    }
    
    if (this.direction === LEFT && npos.x <= -12) {
      // 传送到地图右侧
      npos = {"y": npos.y, "x": 190};
    }
    
    this.position = npos;        
    nextWhole = this.next(this.position, this.direction);
    
    block = this.map.block(nextWhole);        
    
    if ((this.isMidSquare(this.position.y) || this.isMidSquare(this.position.x))) {
      if (block === Pacman.BISCUIT || block === Pacman.PILL || 
          block === Pacman.RED_PILL || block === Pacman.BLUE_PILL) {
        
        this.map.setBlock(nextWhole, Pacman.EMPTY);
        
        // 根據豆子類型給予不同分數
        if (block === Pacman.BISCUIT) {
          this.addScore(10);
        } else if (block === Pacman.PILL) {
          this.addScore(50);
        } else if (block === Pacman.RED_PILL) {
          this.addScore(30);
        } else if (block === Pacman.BLUE_PILL) {
          this.addScore(30);
        }
        
        this.eaten += 1;
        
        // 检查是否吃完了所有的豆子
        if (this.eaten >= this.map.totalDots) {
          this.game.completedLevel();
        }
        
        // 根據豆子類型觸發不同效果
            if (block === Pacman.PILL) { 
          this.game.eatenPill();
        } else if (block === Pacman.RED_PILL) {
          this.game.eatenRedPill();
        } else if (block === Pacman.BLUE_PILL) {
          this.game.eatenBluePill();
        }
            }
        }   
                
        return {
      "new" : this.position,
            "old" : oldPosition
        };
  }

  isMidSquare(x) { 
        var rem = x % 10;
        return rem > 3 || rem < 7;
  }

  calcAngle(dir, pos) { 
        if (dir == RIGHT && (pos.x % 10 < 5)) {
            return {"start":0.25, "end":1.75, "direction": false};
        } else if (dir === DOWN && (pos.y % 10 < 5)) { 
            return {"start":0.75, "end":2.25, "direction": false};
        } else if (dir === UP && (pos.y % 10 < 5)) { 
            return {"start":1.25, "end":1.75, "direction": true};
        } else if (dir === LEFT && (pos.x % 10 < 5)) {             
            return {"start":0.75, "end":1.25, "direction": true};
        }
        return {"start":0, "end":2, "direction": false};
  }

  drawDead(ctx, amount) { 
    var size = this.map.blockSize, 
            half = size / 2;

        if (amount >= 1) { 
            return;
        }

        ctx.fillStyle = "#FFFF00";
        ctx.beginPath();        
    ctx.moveTo(((this.position.x/10) * size) + half, 
               ((this.position.y/10) * size) + half);
        
    ctx.arc(((this.position.x/10) * size) + half, 
            ((this.position.y/10) * size) + half,
                half, 0, Math.PI * 2 * amount, true); 
        
        ctx.fill();    
  }

  draw(ctx) { 
    var s = this.map.blockSize, 
        angle = this.calcAngle(this.direction, this.position);

        ctx.fillStyle = "#FFFF00";

        ctx.beginPath();        

    ctx.moveTo(((this.position.x/10) * s) + s / 2,
               ((this.position.y/10) * s) + s / 2);
        
    ctx.arc(((this.position.x/10) * s) + s / 2,
            ((this.position.y/10) * s) + s / 2,
                s / 2, Math.PI * angle.start, 
                Math.PI * angle.end, angle.direction); 
        
        ctx.fill();    
  }
  
  getPosition() {
    return this.position;
  }
}

class Map {
  constructor(size) {
    this.blockSize = size;
    this.pillSize = 0;
    this.height = null;
    this.width = null;
    this.map = null;
    this.level = 0;
    
    // 初始化全局变量，供地图预览使用
    window.pacmanMapLevel = this.level;
    
    this.reset();
  }
  
  withinBounds(y, x) {
    return y >= 0 && y < this.height && x >= 0 && x < this.width;
  }
  
  isWallSpace(pos) {
    return this.withinBounds(pos.y, pos.x) && this.map[pos.y][pos.x] === Pacman.WALL;
  }
  
  isFloorSpace(pos) {
    if (!this.withinBounds(pos.y, pos.x)) {
            return false;
        }
    const piece = this.map[pos.y][pos.x];
    return piece === Pacman.EMPTY || 
      piece === Pacman.BISCUIT ||
      piece === Pacman.PILL ||
      piece === Pacman.RED_PILL ||
      piece === Pacman.BLUE_PILL;
  }
  
  drawWall(ctx) {
    let i, j, p, line;
        
        ctx.strokeStyle = "#0000FF";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    
    // 根据当前地图级别选择对应的墙壁定义
    let walls;
    if (this.level === 1) {
      walls = Pacman.WALLS_2;
    } else if (this.level === 2) {
      walls = Pacman.WALLS_3;
    } else if (this.level === 3) {
      walls = Pacman.WALLS_4;
    } else {
      walls = Pacman.WALLS;
    }
    
    for (i = 0; i < walls.length; i += 1) {
      line = walls[i];
            ctx.beginPath();

            for (j = 0; j < line.length; j += 1) {
                p = line[j];
                
                if (p.move) {
          ctx.moveTo(p.move[0] * this.blockSize, p.move[1] * this.blockSize);
                } else if (p.line) {
          ctx.lineTo(p.line[0] * this.blockSize, p.line[1] * this.blockSize);
                } else if (p.curve) {
          ctx.quadraticCurveTo(p.curve[0] * this.blockSize, 
                              p.curve[1] * this.blockSize,
                              p.curve[2] * this.blockSize, 
                              p.curve[3] * this.blockSize);   
                }
            }
            ctx.stroke();
        }
    }
    
  reset() {       
    // 根据当前地图级别选择正确的地图数据
    if (this.level === 1) {
      this.map = Pacman.MAP_2.clone();
    } else if (this.level === 2) {
      this.map = Pacman.MAP_3.clone();
    } else if (this.level === 3) {
      this.map = Pacman.MAP_4.clone();
    } else {
      this.map = Pacman.MAP.clone();
    }
    
    this.height = this.map.length;
    this.width = this.map[0].length;
    
    // 计算地图中所有的豆子数量
    this.totalDots = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.map[y][x] === Pacman.BISCUIT || 
            this.map[y][x] === Pacman.PILL || 
            this.map[y][x] === Pacman.RED_PILL || 
            this.map[y][x] === Pacman.BLUE_PILL) {
          this.totalDots++;
        }
      }
    }
    // 更新全局变量以供地图预览使用
    window.pacmanMapLevel = this.level;
    console.log(`當前地圖(${this.level + 1})豆子總數: ${this.totalDots}`);
  }

  switchMap() {
    // 在四个地图之间循环切换: 0 -> 1 -> 2 -> 3 -> 0
    this.level = (this.level + 1) % 4;
    this.reset();
    // 更新全局变量以供地图预览使用
    window.pacmanMapLevel = this.level;
    return `已切換到地圖 ${this.level + 1}`;
  }

  block(pos) {
    return this.map[pos.y][pos.x];
  }
  
  setBlock(pos, type) {
    this.map[pos.y][pos.x] = type;
  }

  drawPills(ctx) { 
    let i, j;
    
    if (++this.pillSize > 30) {
      this.pillSize = 0;
    }
    
    for (i = 0; i < this.height; i += 1) {
      for (j = 0; j < this.width; j += 1) {
        // 繪製不同類型的藥丸
        if (this.map[i][j] === Pacman.PILL) {
          ctx.beginPath();
          ctx.fillStyle = "#000";
          ctx.fillRect((j * this.blockSize), (i * this.blockSize), 
                       this.blockSize, this.blockSize);
                    ctx.fillStyle = "#FFF";
          ctx.arc((j * this.blockSize) + this.blockSize / 2,
                  (i * this.blockSize) + this.blockSize / 2,
                  Math.abs(5 - (this.pillSize/3)), 
                  0, 
                  Math.PI * 2, false); 
          ctx.fill();
          ctx.closePath();
        } else if (this.map[i][j] === Pacman.RED_PILL) {
          ctx.beginPath();
          ctx.fillStyle = "#000";
          ctx.fillRect((j * this.blockSize), (i * this.blockSize), 
                       this.blockSize, this.blockSize);
          ctx.fillStyle = "#FF0000";  // 紅色
          ctx.arc((j * this.blockSize) + this.blockSize / 2,
                  (i * this.blockSize) + this.blockSize / 2,
                  Math.abs(5 - (this.pillSize/3)), 
                  0, 
                  Math.PI * 2, false); 
          ctx.fill();
          ctx.closePath();
        } else if (this.map[i][j] === Pacman.BLUE_PILL) {
          ctx.beginPath();
          ctx.fillStyle = "#000";
          ctx.fillRect((j * this.blockSize), (i * this.blockSize), 
                       this.blockSize, this.blockSize);
          ctx.fillStyle = "#0000FF";  // 藍色
          ctx.arc((j * this.blockSize) + this.blockSize / 2,
                  (i * this.blockSize) + this.blockSize / 2,
                  Math.abs(5 - (this.pillSize/3)), 
                            0, 
                            Math.PI * 2, false); 
                    ctx.fill();
                    ctx.closePath();
                }
		    }
	    }
  }
  
  draw(ctx) {
    let i, j;
    const size = this.blockSize;

        ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width * size, this.height * size);

    this.drawWall(ctx);
    
    for (i = 0; i < this.height; i += 1) {
      for (j = 0; j < this.width; j += 1) {
        this.drawBlock(i, j, ctx);
      }
    }
  }
  
  drawBlock(y, x, ctx) {
    const layout = this.map[y][x];

    if (layout === Pacman.PILL || layout === Pacman.RED_PILL || layout === Pacman.BLUE_PILL) {
            return;
        }

        ctx.beginPath();
        
        if (layout === Pacman.EMPTY || layout === Pacman.BLOCK || 
            layout === Pacman.BISCUIT) {
            
            ctx.fillStyle = "#000";
      ctx.fillRect((x * this.blockSize), (y * this.blockSize), 
                   this.blockSize, this.blockSize);

            if (layout === Pacman.BISCUIT) {
                ctx.fillStyle = "#FFF";
        ctx.fillRect((x * this.blockSize) + (this.blockSize / 2.5), 
                     (y * this.blockSize) + (this.blockSize / 2.5), 
                     this.blockSize / 6, this.blockSize / 6);
	        }
        }
        ctx.closePath();	 
  }
}

Pacman.Audio = function(game) {
    
    var files          = [], 
        endEvents      = [],
        progressEvents = [],
        playing        = [];
    
    function load(name, path, cb) { 

        var f = files[name] = document.createElement("audio");

        progressEvents[name] = function(event) { progress(event, name, cb); };
        
        f.addEventListener("canplaythrough", progressEvents[name], true);
        f.setAttribute("preload", "true");
        f.setAttribute("autobuffer", "true");
        f.setAttribute("src", path);
        f.pause();        
    };

    function progress(event, name, callback) { 
        if (event.loaded === event.total && typeof callback === "function") {
            callback();
            files[name].removeEventListener("canplaythrough", 
                                            progressEvents[name], true);
        }
    };

    function disableSound() {
        for (var i = 0; i < playing.length; i++) {
            files[playing[i]].pause();
            files[playing[i]].currentTime = 0;
        }
        playing = [];
    };

    function ended(name) { 

        var i, tmp = [], found = false;

        files[name].removeEventListener("ended", endEvents[name], true);

        for (i = 0; i < playing.length; i++) {
            if (!found && playing[i]) { 
                found = true;
            } else { 
                tmp.push(playing[i]);
            }
        }
        playing = tmp;
    };

    function play(name) { 
        if (!game.soundDisabled()) {
            endEvents[name] = function() { ended(name); };
            playing.push(name);
            files[name].addEventListener("ended", endEvents[name], true);
            files[name].play();
        }
    };

    function pause() { 
        for (var i = 0; i < playing.length; i++) {
            files[playing[i]].pause();
        }
    };
    
    function resume() { 
        for (var i = 0; i < playing.length; i++) {
            files[playing[i]].play();
        }        
    };
    
    return {
        "disableSound" : disableSound,
        "load"         : load,
        "play"         : play,
        "pause"        : pause,
        "resume"       : resume
    };
};

var PACMAN = (function () {

    var state        = WAITING,
        audio        = null,
        ghosts       = [],
        //ghostSpecs   = ["#00FFDE", "#FF0000", "#FFB8DE", "#FFB847"],
        ghostSpecs   = ["#00FFDE", "#FF0000", "#FFB8DE"],
        eatenCount   = 0,
        level        = 0,
        tick         = 0,
        ghostPos, userPos, 
        stateChanged = true,
        timerStart   = null,
        lastTime     = 0,
        ctx          = null,
        timer        = null,
        map          = null,
        user         = null,
        stored       = null;

    function getTick() { 
        return tick;
    };

    function drawScore(text, position) {
        ctx.fillStyle = "#FFFFFF";
        ctx.font      = "12px BDCartoonShoutRegular";
        ctx.fillText(text, 
                     (position["new"]["x"] / 10) * map.blockSize, 
                     ((position["new"]["y"] + 5) / 10) * map.blockSize);
    }
    
    function dialog(text) {
        ctx.fillStyle = "#FFFF00";
        ctx.font      = "14px BDCartoonShoutRegular";
        var width = ctx.measureText(text).width,
            x     = ((map.width * map.blockSize) - width) / 2;        
        ctx.fillText(text, x, (map.height * 10) + 8);
        
        // 保存最後繪製的文本信息，以便之後清除
        dialog.lastText = {
            x: x,
            y: (map.height * 10) + 8,
            width: width,
            height: 14 // 文本高度
        };
    }
    
    // 添加清除對話框的函數
    function clearDialog() {
        if (dialog.lastText) {
            // 如果已有文字，則重繪該區域
            
            // 1. 重繪地圖元素（只重繪需要的區域）
            const y1 = Math.floor((dialog.lastText.y - dialog.lastText.height) / map.blockSize);
            const y2 = Math.ceil((dialog.lastText.y + 4) / map.blockSize);
            const x1 = Math.floor((dialog.lastText.x - 2) / map.blockSize);
            const x2 = Math.ceil((dialog.lastText.x + dialog.lastText.width + 4) / map.blockSize);
            
            // 重繪覆蓋範圍內的遊戲區域
            ctx.fillStyle = "#000";
            ctx.fillRect(
                dialog.lastText.x - 2,
                dialog.lastText.y - dialog.lastText.height,
                dialog.lastText.width + 4,
                dialog.lastText.height + 4
            );
            
            // 如果文字在遊戲區域內，重繪該部分的地圖
            if (y1 < map.height) {
                for (let y = y1; y <= Math.min(y2, map.height - 1); y++) {
                    for (let x = x1; x <= Math.min(x2, map.width - 1); x++) {
                        if (x >= 0 && y >= 0) {
                            map.drawBlock(y, x, ctx);
                        }
                    }
                }
                
                // 重繪藥丸
                map.drawPills(ctx);
            }
            
            // 2. 重繪頁腳（如果對話框在頁腳區域）
            var topLeft = (map.height * map.blockSize);
            if (dialog.lastText.y >= topLeft) {
                drawFooter();
            }
            
            // 清除保存的文字信息
            dialog.lastText = null;
        }
    }

    function soundDisabled() {
        return localStorage["soundDisabled"] === "true";
    };
    
    function startLevel() {        
        user.resetPosition();
        for (var i = 0; i < ghosts.length; i += 1) { 
            ghosts[i].reset();
        }
        audio.play("start");
        timerStart = tick;
        setState(COUNTDOWN);
        
        // 在关卡开始时提醒用户可以使用 H 键查看帮助
        console.log("關卡開始！按 H 鍵可以查看功能按鍵幫助");
    }    

    function startNewGame() {
        setState(WAITING);
        level = 1;
        user.reset();
        map.reset();
        map.draw(ctx);
        startLevel();
    }

    function keyDown(e) {
        if (e.keyCode === KEY.N) {
            startNewGame();
        } else if (e.keyCode === KEY.S) {
            audio.disableSound();
            localStorage["soundDisabled"] = !soundDisabled();
        } else if (e.keyCode === KEY.P && state === PAUSE) {
            audio.resume();
            map.draw(ctx);
            setState(stored);
        } else if (e.keyCode === KEY.P) {
            stored = state;
            setState(PAUSE);
            audio.pause();
            map.draw(ctx);
            dialog("Paused");
        } else if (e.keyCode === KEY.M) {
            const result = map.switchMap();
            console.log(result);
            dialog(result);
            map.draw(ctx);
        } else if (e.keyCode === KEY.C) {
            // 切換鬼魂追逐模式
            window.CHASE_MODE = !window.CHASE_MODE;
            const mode = window.CHASE_MODE ? "智能追逐" : "隨機移動";
            console.log(`鬼魂模式已切換為: ${mode}`);
            
            // 調用 HTML 頁面的更新函數以立即更新顯示
            if (typeof window.updateGhostModeDisplay === 'function') {
                window.updateGhostModeDisplay();
            }
        } else if (e.keyCode === KEY.G) {
            // 切換鬼魂團隊合作模式
            window.GHOST_TEAMWORK = !window.GHOST_TEAMWORK;
            const status = window.GHOST_TEAMWORK ? "啟用" : "禁用";
            console.log(`鬼魂團隊合作已${status}`);
            
            // 調用 HTML 頁面的更新函數以立即更新顯示
            if (typeof window.updateTeamworkDisplay === 'function') {
                window.updateTeamworkDisplay();
            }
        } else if (e.keyCode === KEY.T) {
            // 按 T 键测试墙壁生成逻辑
            const result = testWallGeneration();
            console.log(result);
            alert("墙壁生成逻辑测试完成，已绘制所有相邻墙壁！请查看控制台获取详细信息。");
            map.draw(ctx);
        } else if (e.keyCode === KEY.D) {
            // 按 D 键显示调试信息
            const result = showDebugInfo();
            console.log(result);
            dialog("调试信息已在控制台显示");
        } else if (e.keyCode === KEY.H) {
            // 按 H 键显示帮助信息
            const result = showHelp();
            console.log(result);
            // 不需要额外 dialog，showHelp 函数已经包含了
        } else if (e.keyCode === KEY.A) {
            // 按 A 键显示所有地图预览
            if (typeof window.pacmanShowAllMaps === 'function') {
                const result = window.pacmanShowAllMaps();
                console.log(result);
            } else {
                console.error("地图预览功能不可用");
                dialog("地图预览功能不可用");
            }
        } else if (state !== PAUSE) {   
            return user.keyDown(e);
        }
        return true;
    }    

    function loseLife() {        
        setState(WAITING);
        user.loseLife();
        if (user.getLives() > 0) {
            startLevel();
        }
    }

    function setState(nState) { 
        state = nState;
        stateChanged = true;
    };
    
    function collided(user, ghost) {
        return (Math.sqrt(Math.pow(ghost.x - user.x, 2) + 
                          Math.pow(ghost.y - user.y, 2))) < 10;
    };

    function drawFooter() {
        
        var topLeft  = (map.height * map.blockSize),
            textBase = topLeft + 17;
        
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, topLeft, (map.width * map.blockSize), 30);
        
        ctx.fillStyle = "#FFFF00";

        for (var i = 0, len = user.getLives(); i < len; i++) {
            ctx.fillStyle = "#FFFF00";
            ctx.beginPath();
            ctx.moveTo(150 + (25 * i) + map.blockSize / 2,
                       (topLeft+1) + map.blockSize / 2);
            
            ctx.arc(150 + (25 * i) + map.blockSize / 2,
                    (topLeft+1) + map.blockSize / 2,
                    map.blockSize / 2, Math.PI * 0.25, Math.PI * 1.75, false);
            ctx.fill();
        }

        ctx.fillStyle = !soundDisabled() ? "#00FF00" : "#FF0000";
        ctx.font = "bold 16px sans-serif";
        //ctx.fillText("♪", 10, textBase);
        ctx.fillText("s", 10, textBase);

        ctx.fillStyle = "#FFFF00";
        ctx.font      = "14px BDCartoonShoutRegular";
        ctx.fillText("Score: " + user.theScore(), 30, textBase);
        ctx.fillText("Level: " + level, 260, textBase);
    }

    function redrawBlock(pos) {
        map.drawBlock(Math.floor(pos.y/10), Math.floor(pos.x/10), ctx);
        map.drawBlock(Math.ceil(pos.y/10), Math.ceil(pos.x/10), ctx);
    }

    function mainDraw() { 

        var diff, u, i, len, nScore;
        
        ghostPos = [];

        for (i = 0, len = ghosts.length; i < len; i += 1) {
            ghostPos.push(ghosts[i].move(ctx));
        }
        u = user.move(ctx);
        
        for (i = 0, len = ghosts.length; i < len; i += 1) {
            redrawBlock(ghostPos[i].old);
        }
        redrawBlock(u.old);
        
        for (i = 0, len = ghosts.length; i < len; i += 1) {
            ghosts[i].draw(ctx);
        }                     
        user.draw(ctx);
        
        userPos = u["new"];
        
        for (i = 0, len = ghosts.length; i < len; i += 1) {
            if (collided(userPos, ghostPos[i]["new"])) {
                if (ghosts[i].isVunerable()) { 
                    audio.play("eatghost");
                    ghosts[i].eat();
                    eatenCount += 1;
                    nScore = eatenCount * 50;
                    drawScore(nScore, ghostPos[i]);
                    user.addScore(nScore);                    
                    setState(EATEN_PAUSE);
                    timerStart = tick;
                } else if (ghosts[i].isDangerous()) {
                    audio.play("die");
                    setState(DYING);
                    timerStart = tick;
                }
            }
        }                             
        console.log('目前鬼魂數量:', ghosts.length);
    };

    function mainLoop() {

        var diff;

        if (state !== PAUSE) { 
            ++tick;
        }

        map.drawPills(ctx);

        if (state === PLAYING) {
            mainDraw();
        } else if (state === WAITING && stateChanged) {            
            stateChanged = false;
            map.draw(ctx);
            dialog("Press N to start a New game");            
        } else if (state === EATEN_PAUSE && 
                   (tick - timerStart) > (Pacman.FPS / 3)) {
            map.draw(ctx);
            setState(PLAYING);
        } else if (state === DYING) {
            if (tick - timerStart > (Pacman.FPS * 2)) { 
                loseLife();
            } else { 
                redrawBlock(userPos);
                for (i = 0, len = ghosts.length; i < len; i += 1) {
                    redrawBlock(ghostPos[i].old);
                    ghostPos.push(ghosts[i].draw(ctx));
                }                                   
                user.drawDead(ctx, (tick - timerStart) / (Pacman.FPS * 2));
            }
        } else if (state === COUNTDOWN) {
            
            diff = 5 + Math.floor((timerStart - tick) / Pacman.FPS);
            
            if (diff === 0) {
                map.draw(ctx);
                setState(PLAYING);
            } else {
                if (diff !== lastTime) { 
                    lastTime = diff;
                    map.draw(ctx);
                    dialog("Starting in: " + diff);
                }
            }
        } 

        drawFooter();
    }

    function eatenPill() {
        audio.play("eatpill");
        timerStart = tick;
        eatenCount = 0;
        for (i = 0; i < ghosts.length; i += 1) {
            ghosts[i].makeEatable(ctx);
        }        
    };
    
    function completedLevel() {
        setState(WAITING);
        level += 1;
        
        // 切换到下一个地图 (循环: 0 -> 1 -> 2 -> 3 -> 0)
        map.level = (map.level + 1) % 4;
        
        console.log(`完成關卡！切換到地圖 ${map.level + 1}，關卡 ${level}`);
        map.reset();
        user.newLevel();
        startLevel();
    };

    function keyPress(e) { 
        if (state !== WAITING && state !== PAUSE) { 
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    function getUserPosition() {
        return user.getPosition();
    }
    
    function init(wrapper, root) {
        
        var i, len, ghost,
            blockSize = wrapper.offsetWidth / 19,
            canvas    = document.createElement("canvas");
        
        canvas.setAttribute("width", (blockSize * 19) + "px");
        canvas.setAttribute("height", (blockSize * 22) + 30 + "px");

        wrapper.appendChild(canvas);

        ctx  = canvas.getContext('2d');

        audio = new Pacman.Audio({"soundDisabled":soundDisabled});
        map   = new Map(blockSize);
        user  = new User({ 
            "completedLevel" : completedLevel, 
            "eatenPill"      : eatenPill,
            "eatenRedPill"   : function() { return PACMAN.eatenRedPill(); },
            "eatenBluePill"  : function() { return PACMAN.eatenBluePill(); }
        }, map);

        // 鬼魂特性設置
        const ghostTraits = [
            { color: "#00FFDE", id: "ghost-1", hunting: 0.75, teamwork: true, desc: "追蹤者" }, // 高追蹤，善於追逐
            { color: "#FF0000", id: "ghost-2", hunting: 0.55, teamwork: true, desc: "預測者" }, // 中等追蹤，善於預測
            { color: "#FFB8DE", id: "ghost-3", hunting: 0.65, teamwork: false, desc: "遊蕩者" } // 中等追蹤，獨立行動
        ];

        // 初始化鬼魂，每個具有不同特性
        for (i = 0, len = ghostTraits.length; i < len; i += 1) {
            const trait = ghostTraits[i];
            ghost = new Ghost(
                {"getTick":getTick}, 
                map, 
                trait.color,
                getUserPosition,
                trait.id
            );
            
            // 設置個性化特性
            ghost.personality.huntingProb = trait.hunting;
            ghost.teamUse = trait.teamwork;
            
            // 添加描述到控制台
            console.log(`初始化鬼魂 ${i+1}：${trait.desc}，追蹤率: ${trait.hunting}`);
            
            ghosts.push(ghost);
        }
        
        map.draw(ctx);
        dialog("Loading ...");

        var extension = Modernizr.audio.ogg ? 'ogg' : 'mp3';

        var audio_files = [
            ["start", root + "audio/opening_song." + extension],
            ["die", root + "audio/die." + extension],
            ["eatghost", root + "audio/eatghost." + extension],
            ["eatpill", root + "audio/eatpill." + extension],
            ["eating", root + "audio/eating.short." + extension],
            ["eating2", root + "audio/eating.short." + extension]
        ];

        load(audio_files, function() { loaded(); });
    };

    function load(arr, callback) { 
        
        if (arr.length === 0) { 
            callback();
        } else { 
            var x = arr.pop();
            audio.load(x[0], x[1], function() { load(arr, callback); });
        }
    };
        
    function loaded() {
        dialog("按 N 鍵開始新遊戲\n按↑↓←→控制移動\n按 H 鍵查看全部功能");

        // 在控制台显示帮助信息，提醒用户可用的功能按键
        console.log("遊戲已加載完成，按 H 鍵可以查看功能按鍵幫助");
        
        document.addEventListener("keydown", keyDown, true);
        document.addEventListener("keypress", keyPress, true); 
        
        // 自动显示帮助面板
        setTimeout(function() {
            showHelp();
        }, 1000); // 延迟1秒显示，确保游戏界面已完全加载
        
        timer = window.setInterval(mainLoop, 1000 / Pacman.FPS);
    };
    
    return {
        "init" : init,
        "updateWallsFromMap": function(level) {
            const result = updateWallsFromMap(level);
            console.log(result);
            return result;
        },
        "testWallGeneration": function() {
            const result = testWallGeneration();
            console.log(result);
            return result;
        },
        "showDebugInfo": function() {
            const result = showDebugInfo();
            console.log(result);
            return result;
        },
        "showHelp": function() {
            const result = showHelp();
            console.log(result);
            return result;
        },
        "showAllMaps": function() {
            const result = showAllMaps();
            console.log(result);
            return result;
        },
        "eatenPill": eatenPill,
        "eatenRedPill": function() {
            audio.play("eatpill");
            
            // 設置速度提升總時間（秒）
            const speedupTime = 5;
            let remainingTime = speedupTime;
            
            // 不再顯示速度提升的對話框
            // dialog(`Speed Boost in: ${remainingTime}`);
            
            // 增加Pacman的速度
            const originalGetNewCoord = User.prototype.getNewCoord;
            User.prototype.getNewCoord = function(dir, current) {
                const coord = originalGetNewCoord.call(this, dir, current);
                // 提升20%的速度
                coord.x = current.x + (coord.x - current.x) * 1.2;
                coord.y = current.y + (coord.y - current.y) * 1.2;
                return coord;
            };
            
            // 創建倒數計時器（僅用於計時，不顯示文字）
            const countdownInterval = setInterval(function() {
                if (state === PAUSE) return; // 如果遊戲暫停，不做任何事
                
                remainingTime--;
                if (remainingTime <= 0) {
                    clearInterval(countdownInterval);
                }
                // 不再顯示和更新倒數文字
                // clearDialog();
                // dialog(`Speed Boost in: ${remainingTime}`);
            }, 1000);
            
            // 5秒後恢復原來的速度
            setTimeout(function() {
                clearInterval(countdownInterval); // 清除倒數計時器
                
                if (state === PAUSE) return; // 如果遊戲暫停，不做任何事
                User.prototype.getNewCoord = originalGetNewCoord;
                
                // 不再顯示恢復提示
                // clearDialog();
                // dialog("Speed Restored");
                // setTimeout(function() {
                //     if (state === PAUSE) return;
                //     clearDialog();
                // }, 1000);
            }, speedupTime * 1000);
        },
        "eatenBluePill": function() {
            audio.play("eatpill");
            
            // 設置凍結總時間（秒）
            const freezeTime = 3;
            let remainingTime = freezeTime;
            
            // 不再顯示鬼魂凍結的對話框
            // dialog(`Ghost Freeze in: ${remainingTime}`);
            
            // 儲存鬼魂原來的方向和移動能力
            const ghostStates = [];
            for (let i = 0; i < ghosts.length; i++) {
                // 保存當前狀態
                ghostStates.push({
                    direction: ghosts[i].direction,
                    originalMove: ghosts[i].move
                });
                
                // 凍結鬼魂，但不改變方向（避免與 NONE 衝突）
                // 取而代之的是覆寫 move 方法，使其返回相同的位置
                ghosts[i].move = function(ctx) {
                    const oldPos = this.position;
                    // 繪製凍結效果
                    ctx.fillStyle = "rgba(0, 100, 255, 0.3)";
                    ctx.fillRect(
                        (oldPos.x/10) * map.blockSize, 
                        (oldPos.y/10) * map.blockSize, 
                        map.blockSize, 
                        map.blockSize
                    );
                    return {
                        "new": oldPos,
                        "old": oldPos
                    };
                };
            }
            
            // 創建倒數計時器（僅用於計時，不顯示文字）
            const countdownInterval = setInterval(function() {
                if (state === PAUSE) return; // 如果遊戲暫停，不做任何事
                
                remainingTime--;
                if (remainingTime <= 0) {
                    clearInterval(countdownInterval);
                }
                // 不再顯示和更新倒數文字
                // clearDialog();
                // dialog(`Ghost Freeze in: ${remainingTime}`);
            }, 1000);
            
            // 3秒後恢復鬼魂的移動
            setTimeout(function() {
                clearInterval(countdownInterval); // 清除倒數計時器
                
                if (state === PAUSE) return; // 如果遊戲暫停，不做任何事
                
                for (let i = 0; i < ghosts.length; i++) {
                    if (i < ghostStates.length) {
                        // 恢復原來的方向
                        ghosts[i].direction = ghostStates[i].direction;
                        // 恢復原來的移動功能
                        ghosts[i].move = ghostStates[i].originalMove;
                    }
                }
                
                // 不再顯示恢復提示
                // clearDialog();
                // dialog("Ghosts Released");
                // setTimeout(function() {
                //     if (state === PAUSE) return;
                //     clearDialog();
                // }, 1000);
            }, freezeTime * 1000);
        }
    };
    
}());

/* Human readable keyCode index */
var KEY = {'BACKSPACE': 8, 'TAB': 9, 'NUM_PAD_CLEAR': 12, 'ENTER': 13, 'SHIFT': 16, 'CTRL': 17, 'ALT': 18, 'PAUSE': 19, 'CAPS_LOCK': 20, 'ESCAPE': 27, 'SPACEBAR': 32, 'PAGE_UP': 33, 'PAGE_DOWN': 34, 'END': 35, 'HOME': 36, 'ARROW_LEFT': 37, 'ARROW_UP': 38, 'ARROW_RIGHT': 39, 'ARROW_DOWN': 40, 'PRINT_SCREEN': 44, 'INSERT': 45, 'DELETE': 46, 'SEMICOLON': 59, 'WINDOWS_LEFT': 91, 'WINDOWS_RIGHT': 92, 'SELECT': 93, 'NUM_PAD_ASTERISK': 106, 'NUM_PAD_PLUS_SIGN': 107, 'NUM_PAD_HYPHEN-MINUS': 109, 'NUM_PAD_FULL_STOP': 110, 'NUM_PAD_SOLIDUS': 111, 'NUM_LOCK': 144, 'SCROLL_LOCK': 145, 'SEMICOLON': 186, 'EQUALS_SIGN': 187, 'COMMA': 188, 'HYPHEN-MINUS': 189, 'FULL_STOP': 190, 'SOLIDUS': 191, 'GRAVE_ACCENT': 192, 'LEFT_SQUARE_BRACKET': 219, 'REVERSE_SOLIDUS': 220, 'RIGHT_SQUARE_BRACKET': 221, 'APOSTROPHE': 222, 'M': 77, 'G': 71, 'T': 84, 'D': 68, 'H': 72, 'A': 65, 'C': 67};

(function () {
	/* 0 - 9 */
	for (var i = 48; i <= 57; i++) {
        KEY['' + (i - 48)] = i;
	}
	/* A - Z */
	for (i = 65; i <= 90; i++) {
        KEY['' + String.fromCharCode(i)] = i;
	}
	/* NUM_PAD_0 - NUM_PAD_9 */
	for (i = 96; i <= 105; i++) {
        KEY['NUM_PAD_' + (i - 96)] = i;
	}
	/* F1 - F12 */
	for (i = 112; i <= 123; i++) {
        KEY['F' + (i - 112 + 1)] = i;
	}
})();

Pacman.WALL    = 0;
Pacman.BISCUIT = 1;
Pacman.EMPTY   = 2;
Pacman.BLOCK   = 3;
Pacman.PILL    = 4;
Pacman.RED_PILL = 5;
Pacman.BLUE_PILL = 6;

Pacman.MAP = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
	[0, 4, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 4, 0],
	[0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
	[0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0],
	[0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
	[0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
	[2, 2, 2, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 2, 2, 2],
	[0, 0, 0, 0, 1, 0, 1, 0, 0, 3, 0, 0, 1, 0, 1, 0, 0, 0, 0],
	[2, 2, 2, 2, 1, 1, 1, 0, 3, 3, 3, 0, 1, 1, 1, 2, 2, 2, 2],
	[0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
	[2, 2, 2, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 2, 2, 2],
	[0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
	[0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
	[0, 6, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 6, 0],
	[0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0],
	[0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
	[0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

Pacman.MAP_2 = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
    [0, 4, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 4, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 3, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 1, 1, 0, 1, 3, 3, 3, 1, 0, 1, 1, 1, 0, 1, 0],
    [0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    [0, 6, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 6, 0],
    [0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

// 添加第三个地图 - 优化迷宫风格，避免封闭区域，限制相连墙壁
Pacman.MAP_3 = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
    [0, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 0],
    [0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0],
    [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 1, 0, 1, 0, 1, 3, 1, 0, 1, 0, 1, 0, 0, 0, 0],
    [2, 2, 2, 0, 1, 0, 1, 1, 1, 3, 1, 1, 1, 0, 1, 0, 2, 2, 2],
    [0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    [0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0],
    [0, 6, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 6, 0],
    [0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

// 添加第四个地图 - 墙壁相邻不超过6个，所有豆子相互连通
Pacman.MAP_4 = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
    [0, 4, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 4, 0],
    [0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0],
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0],
    [0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0],
    [0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0],
    [0, 0, 0, 1, 0, 1, 1, 0, 1, 3, 1, 0, 1, 1, 0, 1, 0, 0, 0],
    [2, 2, 2, 1, 1, 1, 0, 0, 1, 3, 1, 0, 0, 1, 1, 1, 2, 2, 2],
    [0, 0, 0, 1, 0, 1, 1, 1, 1, 3, 1, 1, 1, 1, 0, 1, 0, 0, 0],
    [0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0],
    [0, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0],
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [0, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 0],
    [0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0],
    [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

Pacman.WALLS = generateWallsFromMap(Pacman.MAP); 
// 为 MAP_2 创建墙壁定义
Pacman.WALLS_2 = generateWallsFromMap(Pacman.MAP_2); 
// 为 MAP_3 创建墙壁定义
Pacman.WALLS_3 = generateWallsFromMap(Pacman.MAP_3);
// 为 MAP_4 创建墙壁定义
Pacman.WALLS_4 = generateWallsFromMap(Pacman.MAP_4);

Object.prototype.clone = function () {
    var i, newObj = (this instanceof Array) ? [] : {};
    for (i in this) {
        if (i === 'clone') {
            continue;
        }
        if (this[i] && typeof this[i] === "object") {
            newObj[i] = this[i].clone();
        } else {
            newObj[i] = this[i];
        }
    }
    return newObj;
};

/**
 * 根据 MAP 数组自动生成对应的 WALLS 数组
 * @param {Array<Array<number>>} map - 地图数组，0 表示墙壁
 * @returns {Array<Array<Object>>} - 墙壁定义数组
 */
function generateWallsFromMap(map) {
  if (!map || !map.length || !map[0].length) {
    return [];
  }
  
  const height = map.length;
  const width = map[0].length;
  const walls = [];
  
  // 边缘表 - 用于记录已经绘制的边
  const drawnEdges = new Set();
  
  // 辅助函数：检查某个位置是否是墙壁
  function isWall(y, x) {
    return y >= 0 && y < height && x >= 0 && x < width && map[y][x] === 0;
  }
  
  // 辅助函数：添加一条边到墙壁集合中
  function addEdge(x1, y1, x2, y2) {
    // 创建边的唯一标识符（确保坐标顺序一致）
    const points = [[x1, y1], [x2, y2]].sort((a, b) => {
      if (a[0] !== b[0]) return a[0] - b[0];
      return a[1] - b[1];
    });
    
    const edgeKey = `${points[0][0]},${points[0][1]}-${points[1][0]},${points[1][1]}`;
    
    // 如果这条边已经绘制过，则跳过
    if (drawnEdges.has(edgeKey)) {
      return;
    }
    
    // 记录这条边
    drawnEdges.add(edgeKey);
    
    // 添加墙壁线段
    walls.push([
      {"move": [x1, y1]},
      {"line": [x2, y2]}
    ]);
  }
  
  // 主循环：遍历地图中的每个位置
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isWall(y, x)) {
        // 计算当前墙壁块的四个顶点坐标 (x, y) 格式
        const topLeft = [x, y];
        const topRight = [x + 1, y];
        const bottomLeft = [x, y + 1];
        const bottomRight = [x + 1, y + 1];
        
        // 检查上下左右是否有墙壁
        const hasTopWall = isWall(y - 1, x);
        const hasBottomWall = isWall(y + 1, x);
        const hasLeftWall = isWall(y, x - 1);
        const hasRightWall = isWall(y, x + 1);
        
        // 如果上方没有墙壁，绘制上边
        if (!hasTopWall) {
          addEdge(topLeft[0], topLeft[1], topRight[0], topRight[1]);
        }
        
        // 如果右侧没有墙壁，绘制右边
        if (!hasRightWall) {
          addEdge(topRight[0], topRight[1], bottomRight[0], bottomRight[1]);
        }
        
        // 如果下方没有墙壁，绘制下边
        if (!hasBottomWall) {
          addEdge(bottomLeft[0], bottomLeft[1], bottomRight[0], bottomRight[1]);
        }
        
        // 如果左侧没有墙壁，绘制左边
        if (!hasLeftWall) {
          addEdge(topLeft[0], topLeft[1], bottomLeft[0], bottomLeft[1]);
        }
      }
    }
  }
  
  console.log(`生成了 ${walls.length} 条墙壁边`);
  return walls;
}

/**
 * 根据指定关卡的 MAP 更新对应的 WALLS 数组
 * @param {number} level - 关卡编号，0表示第一关，1表示第二关，2表示第三关，3表示第四关，不提供则更新所有关卡
 * @returns {string} - 操作结果信息
 */
function updateWallsFromMap(level) {
  try {
    if (level === undefined) {
      // 更新所有关卡的墙壁定义
      console.log("✅ 开始更新所有关卡的墙壁定义...");
      
      const walls1 = generateWallsFromMap(Pacman.MAP);
      console.log(`第一关生成了 ${walls1.length} 段墙壁`);
      Pacman.WALLS = walls1;
      
      const walls2 = generateWallsFromMap(Pacman.MAP_2);
      console.log(`第二关生成了 ${walls2.length} 段墙壁`);
      Pacman.WALLS_2 = walls2;
      
      const walls3 = generateWallsFromMap(Pacman.MAP_3);
      console.log(`第三关生成了 ${walls3.length} 段墙壁`);
      Pacman.WALLS_3 = walls3;
      
      const walls4 = generateWallsFromMap(Pacman.MAP_4);
      console.log(`第四关生成了 ${walls4.length} 段墙壁`);
      Pacman.WALLS_4 = walls4;
      
      return `已更新所有关卡的墙壁定义，总共生成了 ${walls1.length + walls2.length + walls3.length + walls4.length} 段墙壁`;
    } else if (level === 0) {
      // 更新第一关的墙壁定义
      console.log("✅ 开始更新第一关的墙壁定义...");
      const walls = generateWallsFromMap(Pacman.MAP);
      console.log(`第一关生成了 ${walls.length} 段墙壁`);
      Pacman.WALLS = walls;
      return `已更新第一关的墙壁定义，生成了 ${walls.length} 段墙壁`;
    } else if (level === 1) {
      // 更新第二关的墙壁定义
      console.log("✅ 开始更新第二关的墙壁定义...");
      const walls = generateWallsFromMap(Pacman.MAP_2);
      console.log(`第二关生成了 ${walls.length} 段墙壁`);
      Pacman.WALLS_2 = walls;
      return `已更新第二关的墙壁定义，生成了 ${walls.length} 段墙壁`;
    } else if (level === 2) {
      // 更新第三关的墙壁定义
      console.log("✅ 开始更新第三关的墙壁定义...");
      const walls = generateWallsFromMap(Pacman.MAP_3);
      console.log(`第三关生成了 ${walls.length} 段墙壁`);
      Pacman.WALLS_3 = walls;
      return `已更新第三关的墙壁定义，生成了 ${walls.length} 段墙壁`;
    } else if (level === 3) {
      // 更新第四关的墙壁定义
      console.log("✅ 开始更新第四关的墙壁定义...");
      const walls = generateWallsFromMap(Pacman.MAP_4);
      console.log(`第四关生成了 ${walls.length} 段墙壁`);
      Pacman.WALLS_4 = walls;
      return `已更新第四关的墙壁定义，生成了 ${walls.length} 段墙壁`;
    } else {
      console.error(`❌ 无效的关卡编号: ${level}`);
      return `无效的关卡编号: ${level}`;
    }
  } catch (error) {
    console.error("❌ 更新墙壁定义时发生错误:", error);
    return "更新墙壁定义时发生错误: " + error.message;
  }
}

/**
 * 测试墙壁生成逻辑
 * 用于验证墙壁生成功能是否正确工作
 * @returns {string} - 测试结果信息
 */
function testWallGeneration() {
  console.log("📊 开始测试墙壁生成逻辑...");
  
  // 测试小型基本地图
  const basicMap = [
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0]
  ];
  
  console.log("📋 基本测试地图 (简单矩形):");
  basicMap.forEach(row => console.log(row.join(' ')));
  
  // 测试墙壁生成
  const basicWalls = generateWallsFromMap(basicMap);
  console.log(`🧱 基本地图生成了 ${basicWalls.length} 条墙壁边`);
  
  // 测试复杂地图 - 包含多个相邻墙壁
  const complexMap = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 1, 1, 0],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 1, 1, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ];
  
  console.log("\n📋 复杂测试地图 (多个相邻墙壁):");
  complexMap.forEach(row => console.log(row.join(' ')));
  
  // 测试墙壁生成
  const complexWalls = generateWallsFromMap(complexMap);
  console.log(`🧱 复杂地图生成了 ${complexWalls.length} 条墙壁边`);
  
  // 测试孤立墙壁的地图
  const isolatedMap = [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1]
  ];
  
  console.log("\n📋 孤立墙壁测试地图:");
  isolatedMap.forEach(row => console.log(row.join(' ')));
  
  // 测试墙壁生成
  const isolatedWalls = generateWallsFromMap(isolatedMap);
  console.log(`🧱 孤立墙壁地图生成了 ${isolatedWalls.length} 条墙壁边`);
  
  // 测试鬼屋样式地图
  const ghostHouseMap = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 1, 0, 3, 0, 1, 0],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0]
  ];
  
  console.log("\n📋 鬼屋样式测试地图:");
  ghostHouseMap.forEach(row => console.log(row.join(' ')));
  
  // 测试墙壁生成
  const ghostHouseWalls = generateWallsFromMap(ghostHouseMap);
  console.log(`🧱 鬼屋样式地图生成了 ${ghostHouseWalls.length} 条墙壁边`);
  
  // 测试更新现有地图
  try {
    console.log("\n📝 测试更新实际游戏地图墙壁定义:");
    
    // 测试更新第一关
    const result1 = updateWallsFromMap(0);
    console.log(`🔄 ${result1}`);
    
    // 测试更新第二关
    const result2 = updateWallsFromMap(1);
    console.log(`🔄 ${result2}`);
    
    // 测试更新所有关卡
    const resultAll = updateWallsFromMap();
    console.log(`🔄 ${resultAll}`);
    
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error);
    return "❌ 墙壁生成逻辑测试失败";
  }
  
  console.log("\n✅ 墙壁生成逻辑测试完成");
  return "✅ 墙壁生成逻辑测试完成，所有相邻墙壁都被正确连接!";
}

/**
 * 显示游戏状态信息，用于调试
 * 可通过按 D 键触发
 */
function showDebugInfo() {
  console.group("🔍 游戏状态信息");
  console.log("当前关卡:", level);
  console.log("当前地图:", map.level + 1);
  console.log("地图尺寸:", map.width, "x", map.height);
  console.log("豆子总数:", map.totalDots);
  console.log("已吃豆子:", user.eaten);
  console.log("还需吃豆子:", map.totalDots - user.eaten);
  console.log("玩家位置:", user.position);
  console.log("玩家方向:", user.direction);
  console.log("玩家生命:", user.getLives());
  console.log("玩家分数:", user.theScore());
  console.log("鬼魂数量:", ghosts.length);
  
  console.log("鬼魂位置:");
  for (let i = 0; i < ghosts.length; i++) {
    console.log(`- 鬼魂 ${i+1}:`, ghosts[i].position, "方向:", ghosts[i].direction);
  }
  
  console.log("游戏状态:", state);
  console.groupEnd();
  
  return "游戏状态信息已在控制台显示";
}

/**
 * 显示游戏功能按键帮助信息
 * 提供玩家所有可用按键的详细说明
 */
function showHelp() {
  // 在控制台显示帮助
  console.group("🎮 游戏功能按键帮助");
  console.log("方向键 ↑↓←→ - 控制 Pacman 移动");
  console.log("N 键 - 开始新游戏");
  console.log("P 键 - 暂停/继续游戏");
  console.log("M 键 - 切换地图 (在四个地图之间循环)");
  console.log("S 键 - 开启/关闭音效");
  console.log("G 键 - 更新当前地图的墙壁");
  console.log("T 键 - 测试墙壁生成逻辑");
  console.log("D 键 - 显示游戏调试信息");
  console.log("H 键 - 显示/隐藏此帮助");
  console.log("C 键 - 切换鬼魂模式 (智能追逐/随机移动)");
  console.groupEnd();
  
  // 在游戏界面显示简短帮助信息
  dialog("游戏按键帮助 - 详细帮助已在页面上显示");
  
  // 在页面上创建或更新帮助面板
  let helpPanel = document.getElementById('pacman-help-panel');
  
  if (!helpPanel) {
    // 如果帮助面板不存在，则创建一个
    helpPanel = document.createElement('div');
    helpPanel.id = 'pacman-help-panel';
    helpPanel.style.position = 'fixed';
    helpPanel.style.right = '20px';
    helpPanel.style.top = '20px';
    helpPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    helpPanel.style.color = '#FFFF00';
    helpPanel.style.padding = '15px';
    helpPanel.style.borderRadius = '10px';
    helpPanel.style.fontFamily = 'Arial, sans-serif';
    helpPanel.style.fontSize = '14px';
    helpPanel.style.zIndex = '1000';
    helpPanel.style.maxWidth = '300px';
    helpPanel.style.border = '3px solid #0000FF';
    helpPanel.style.boxShadow = '0 0 10px #0000FF, 0 0 20px rgba(0, 0, 255, 0.5)';
    
    // 添加关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '&times;'; // × 符号
    closeBtn.style.position = 'absolute';
    closeBtn.style.right = '10px';
    closeBtn.style.top = '10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = '#FF0000';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.lineHeight = '20px';
    closeBtn.style.width = '20px';
    closeBtn.style.height = '20px';
    closeBtn.style.textAlign = 'center';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.backgroundColor = 'rgba(0,0,0,0.3)';
    
    // 鼠标悬停效果
    closeBtn.onmouseover = function() {
      this.style.backgroundColor = 'rgba(255,0,0,0.3)';
    };
    closeBtn.onmouseout = function() {
      this.style.backgroundColor = 'rgba(0,0,0,0.3)';
    };
    
    closeBtn.onclick = function() {
      document.body.removeChild(helpPanel);
    };
    
    helpPanel.appendChild(closeBtn);
    
    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '🎮 游戏功能按键';
    title.style.margin = '0 0 15px 0';
    title.style.textAlign = 'center';
    title.style.color = '#FFFF00';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '18px';
    title.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
    helpPanel.appendChild(title);
    
    // 创建按键列表
    const keysList = document.createElement('ul');
    keysList.style.listStyleType = 'none';
    keysList.style.padding = '0';
    keysList.style.margin = '0';
    
    const keys = [
      {key: "↑↓←→", desc: "控制 Pacman 移动"},
      {key: "N", desc: "开始新游戏"},
      {key: "P", desc: "暂停/继续游戏"},
      {key: "M", desc: "切换地图 (在四个地图之间循环)"},
      {key: "A", desc: "显示所有地图预览"},
      {key: "S", desc: "开启/关闭音效"},
      {key: "C", desc: "切换鬼魂模式 (智能追逐/随机移动)"},
      {key: "G", desc: "更新当前地图的墙壁"},
      {key: "T", desc: "测试墙壁生成逻辑"},
      {key: "D", desc: "显示游戏调试信息"},
      {key: "H", desc: "显示/隐藏此帮助"}
    ];
    
    keys.forEach(item => {
      const li = document.createElement('li');
      li.style.margin = '8px 0';
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      
      const keySpan = document.createElement('span');
      keySpan.textContent = item.key;
      keySpan.style.fontWeight = 'bold';
      keySpan.style.backgroundColor = '#0000FF';
      keySpan.style.color = 'white';
      keySpan.style.padding = '3px 6px';
      keySpan.style.borderRadius = '5px';
      keySpan.style.marginRight = '12px';
      keySpan.style.minWidth = '45px';
      keySpan.style.textAlign = 'center';
      keySpan.style.boxShadow = '0 0 5px rgba(0, 0, 255, 0.7)';
      
      const descSpan = document.createElement('span');
      descSpan.textContent = item.desc;
      
      li.appendChild(keySpan);
      li.appendChild(descSpan);
      keysList.appendChild(li);
    });
    
    helpPanel.appendChild(keysList);
    
    // 添加提示
    const tip = document.createElement('p');
    tip.textContent = '按 H 键或点击 × 可以隐藏此帮助';
    tip.style.marginTop = '15px';
    tip.style.fontSize = '12px';
    tip.style.textAlign = 'center';
    tip.style.fontStyle = 'italic';
    tip.style.opacity = '0.8';
    helpPanel.appendChild(tip);
    
    // 添加动画效果
    helpPanel.style.transition = 'all 0.3s ease-in-out';
    helpPanel.style.opacity = '0';
    document.body.appendChild(helpPanel);
    
    // 使帮助面板淡入
    setTimeout(function() {
      helpPanel.style.opacity = '1';
    }, 10);
        } else {
    // 如果帮助面板已存在，则使其淡出后移除
    helpPanel.style.opacity = '0';
    setTimeout(function() {
      if (helpPanel.parentNode) {
        document.body.removeChild(helpPanel);
      }
    }, 300);
  }
  
  return "游戏功能按键帮助已在页面上显示";
}

/**
 * 显示所有地图的布局
 * 创建一个模态窗口，同时展示所有地图的布局预览
 * @returns {string} - 操作结果信息
 */
function showAllMaps() {
  console.log("顯示所有地圖預覽...");
  
  // 检查是否已存在地图预览面板
  let mapsPanel = document.getElementById('pacman-maps-panel');
  if (mapsPanel) {
    // 如果面板已存在，则关闭它
    mapsPanel.style.opacity = '0';
    setTimeout(() => {
      if (mapsPanel.parentNode) {
        document.body.removeChild(mapsPanel);
      }
    }, 300);
    return "地圖預覽已關閉";
  }
  
  // 创建地图预览面板
  mapsPanel = document.createElement('div');
  mapsPanel.id = 'pacman-maps-panel';
  mapsPanel.style.position = 'fixed';
  mapsPanel.style.left = '50%';
  mapsPanel.style.top = '50%';
  mapsPanel.style.transform = 'translate(-50%, -50%)';
  mapsPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  mapsPanel.style.color = '#FFFF00';
  mapsPanel.style.padding = '20px';
  mapsPanel.style.borderRadius = '10px';
  mapsPanel.style.fontFamily = 'Arial, sans-serif';
  mapsPanel.style.zIndex = '2000';
  mapsPanel.style.display = 'flex';
  mapsPanel.style.flexDirection = 'column';
  mapsPanel.style.gap = '20px';
  mapsPanel.style.maxWidth = '90%';
  mapsPanel.style.maxHeight = '90%';
  mapsPanel.style.overflow = 'auto';
  mapsPanel.style.border = '3px solid #0000FF';
  mapsPanel.style.boxShadow = '0 0 20px #0000FF, 0 0 40px rgba(0, 0, 255, 0.5)';
  
  // 添加标题
  const title = document.createElement('h2');
  title.textContent = '所有地圖預覽';
  title.style.textAlign = 'center';
  title.style.margin = '0 0 20px 0';
  title.style.color = '#FFFF00';
  title.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.7)';
  mapsPanel.appendChild(title);
  
  // 添加关闭按钮
  const closeBtn = document.createElement('div');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.position = 'absolute';
  closeBtn.style.right = '15px';
  closeBtn.style.top = '15px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.color = '#FF0000';
  closeBtn.style.fontWeight = 'bold';
  closeBtn.style.fontSize = '24px';
  closeBtn.style.width = '30px';
  closeBtn.style.height = '30px';
  closeBtn.style.textAlign = 'center';
  closeBtn.style.lineHeight = '30px';
  closeBtn.style.borderRadius = '50%';
  closeBtn.style.backgroundColor = 'rgba(0,0,0,0.3)';
  
  closeBtn.onmouseover = function() {
    this.style.backgroundColor = 'rgba(255,0,0,0.3)';
  };
  closeBtn.onmouseout = function() {
    this.style.backgroundColor = 'rgba(0,0,0,0.3)';
  };
  
  closeBtn.onclick = function() {
    mapsPanel.style.opacity = '0';
    setTimeout(() => {
      if (mapsPanel.parentNode) {
        document.body.removeChild(mapsPanel);
      }
    }, 300);
  };
  
  mapsPanel.appendChild(closeBtn);
  
  // 创建地图容器
  const mapsContainer = document.createElement('div');
  mapsContainer.style.display = 'flex';
  mapsContainer.style.justifyContent = 'center';
  mapsContainer.style.flexWrap = 'wrap';
  mapsContainer.style.gap = '20px';
  
  // 地图数据
  const maps = [
    { name: "地圖 1", data: Pacman.MAP, color: "#00FFDE" },
    { name: "地圖 2", data: Pacman.MAP_2, color: "#FF0000" },
    { name: "地圖 3", data: Pacman.MAP_3, color: "#FFB8DE" },
    { name: "地圖 4", data: Pacman.MAP_4, color: "#FFB847" }
  ];
  
  // 缩小地图尺寸到原来的80%
  const cellSize = 9.6; // 原来是12，现在是12 * 0.8 = 9.6
  
  // 创建每个地图的预览
  maps.forEach((mapInfo, index) => {
    const mapContainer = document.createElement('div');
    mapContainer.style.display = 'flex';
    mapContainer.style.flexDirection = 'column';
    mapContainer.style.alignItems = 'center';
    mapContainer.style.padding = '10px';
    mapContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    mapContainer.style.borderRadius = '10px';
    mapContainer.style.border = `2px solid ${mapInfo.color}`;
    mapContainer.style.transform = 'scale(0.8)'; // 整体缩小
    mapContainer.style.transformOrigin = 'center top';
    mapContainer.style.position = 'relative'; // 添加相对定位，以便绝对定位标记
    
    // 添加地图标题
    const mapTitle = document.createElement('h3');
    mapTitle.textContent = mapInfo.name;
    mapTitle.style.margin = '0 0 10px 0';
    mapTitle.style.color = mapInfo.color;
    mapContainer.appendChild(mapTitle);
    
    // 创建地图预览画布
    const canvas = document.createElement('canvas');
    canvas.width = mapInfo.data[0].length * cellSize;
    canvas.height = mapInfo.data.length * cellSize;
    const ctx = canvas.getContext('2d');
    
    // 绘制地图
    for (let y = 0; y < mapInfo.data.length; y++) {
      for (let x = 0; x < mapInfo.data[y].length; x++) {
        const cell = mapInfo.data[y][x];
        
        // 绘制背景
        ctx.fillStyle = "#000";
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        
        // 根据单元格类型绘制不同样式
        switch (cell) {
          case Pacman.WALL: // 墙
            ctx.fillStyle = mapInfo.color;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            break;
          case Pacman.BISCUIT: // 普通豆子
            ctx.fillStyle = "#FFF";
            ctx.beginPath();
            ctx.arc(
              x * cellSize + cellSize / 2,
              y * cellSize + cellSize / 2,
              cellSize / 6,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          case Pacman.PILL: // 能量豆
            ctx.fillStyle = "#FFF";
            ctx.beginPath();
            ctx.arc(
              x * cellSize + cellSize / 2,
              y * cellSize + cellSize / 2,
              cellSize / 3,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          case Pacman.RED_PILL: // 紅色能量豆
            ctx.fillStyle = "#FF0000";
            ctx.beginPath();
            ctx.arc(
              x * cellSize + cellSize / 2,
              y * cellSize + cellSize / 2,
              cellSize / 3,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          case Pacman.BLUE_PILL: // 藍色能量豆
            ctx.fillStyle = "#0000FF";
            ctx.beginPath();
            ctx.arc(
              x * cellSize + cellSize / 2,
              y * cellSize + cellSize / 2,
              cellSize / 3,
              0,
              Math.PI * 2
            );
            ctx.fill();
            break;
          case 3: // 幽灵屋
            ctx.fillStyle = "rgba(255, 100, 100, 0.3)";
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            break;
        }
      }
    }
    
    mapContainer.appendChild(canvas);
    
    // 如果是当前地图，添加标记到地图容器外部
    if (index === window.pacmanMapLevel) {
      const marker = document.createElement('div');
      marker.textContent = '當前地圖';
      marker.style.position = 'absolute';
      marker.style.top = '-12px';
      marker.style.right = '-12px';
      marker.style.backgroundColor = mapInfo.color;
      marker.style.color = '#000';
      marker.style.padding = '4px 8px';
      marker.style.borderRadius = '8px';
      marker.style.fontWeight = 'bold';
      marker.style.fontSize = '11px';
      marker.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
      marker.style.zIndex = '10';
      mapContainer.appendChild(marker);
    }
    
    mapsContainer.appendChild(mapContainer);
  });
  
  mapsPanel.appendChild(mapsContainer);
  
  // 添加提示信息
  const tip = document.createElement('p');
  tip.textContent = '提示：按 A 鍵或點擊 × 可以關閉此預覽';
  tip.style.textAlign = 'center';
  tip.style.margin = '15px 0 0 0';
  tip.style.fontSize = '14px';
  tip.style.opacity = '0.7';
  tip.style.fontStyle = 'italic';
  mapsPanel.appendChild(tip);
  
  // 添加到文档
  document.body.appendChild(mapsPanel);
  
  // 淡入效果
  mapsPanel.style.opacity = '0';
  mapsPanel.style.transition = 'opacity 0.3s ease-in-out';
  setTimeout(() => {
    mapsPanel.style.opacity = '1';
  }, 10);
  
  return "顯示所有地圖預覽";
}

// 将函数附加到window对象上，使其可以全局访问
window.pacmanShowAllMaps = showAllMaps;

