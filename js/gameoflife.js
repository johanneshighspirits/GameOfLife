/**
*   Every living cell will be represented
*   by a `Cell` object
*/
function Cell(x, y) {
  this.x = x;
  this.y = y;
}


/**
*   Grid is an object that will hold references to
*   all living cells. The object's keys represent the
*   cells' x position and its values are an array that
*   holds all cells that lives on that x axis.
*   This way we can check if there is a living cell on
*   any given coordinate by asking the Grid for it like:
*   
*     var aLivingCell = grid[x][y];
*
*/
function Grid() {
}

/**
*   Insert a pixel figure to the grid object by providing
*   a two dimensional array populated with the number 1 for
*   living cells and the number 0 for dead.
*   The example below will insert a square at coordinates
*   x: 10px and y: 20px.
*
*     var grid = new Grid();
*     grid.spawn([
*       [1, 1],
*       [1, 1] 
*     ], 10, 20);
*   
*/
Grid.prototype.spawn = function(matrix, x, y) {
  matrix.forEach(function(row, r) {
    row.forEach(function(col, c) {
      if (col == 1) {
        if (this[c + x] === undefined) this[c + x] = [];
        this[c + x][r + y] = new Cell(c + x, r + y);
      }
    }, this);
  }, this);
};

/**
*   ================== The Game of Life ==================
*
*   SETUP:
*   Add a canvas to the DOM. Specify width and height.
*
*   Start the game by calling init. An optional settings
*   object can be passed to init, to further customize
*   the game. It is recommended to at least provide the
*   canvas id. Otherwise it will default to 'game'.
*   Available settings are:
*
*     Name:      Type:    Description:           Default:
*     ----------------------------------------------------
*     canvasId   String   The id for the canvas  'game'
*     cellSize   Number   Width of cells (px)    10
*     fps        Number   Desired framerate      10
*
**/
var gameOfLife = (function() {
  
  "use strict";

  /**
  *   Private variables
  */
  var canvas,
      width,
      height,
      // The amount of pixels available outside
      // the visible game area:
      marginBuffer, 
      marginBufferMultiplier = 8,
      nrOfCells,
      cellSize,
      timer,
      fps,
      frameInterval,
      grid,
      livingCells,
      showTrails,
      c;

  /* ================ SETUP ================ */

  /** 
  *   Set up game play arena.
  */
  function setup(canvasId) {
    // Assign canvas as game play arena and get context.
    canvas = document.getElementById(canvasId);
    c = canvas.getContext('2d');    
    c.fillStyle = 'rgba(50,50,50,1)';

    width = canvas.width;
    height = canvas.height;

    nrOfCells = {
      xAxis: (width + (2 * marginBuffer)) / cellSize,
      yAxis: (height + (2 * marginBuffer)) / cellSize
    };

    livingCells = new Grid();

    // Add game control buttons
    var controlBtns = [
      {
        text: "Reset", 
        action: "stop"
      },    
      {
        text: "Start", 
        action: "playPause",
        className: "blinking"
      },
      {
        text: "Step >>", 
        action: "step"
      }
    ];
    var controlBtnsContainer = createElements(controlBtns);
    controlBtnsContainer.className = "game-controls margin-auto";

    // Add button that will allow user to upload an image
    // to use as simulation starting point. Hide button and
    // only display its label to make css styling easier.
    var addImageLabel = document.createElement('label');
    addImageLabel.className = "button transition";
    addImageLabel.innerHTML = "Upload image...";
    var addImageBtn = document.createElement('input');
    addImageBtn.type = 'file';
    addImageBtn.style.display = 'none';
    addImageLabel.appendChild(addImageBtn);
    controlBtnsContainer.appendChild(addImageLabel);

    // Register event listeners
    addImageBtn.addEventListener('change', handleImageUpload);
    addImageBtn.addEventListener('click', stop);

    // When clicking on canvas, clicked cell should come alive
    canvas.addEventListener('mousedown', handleMouseDown);
    controlBtnsContainer.addEventListener('click', handleControlBtnClick);

    // Add game control buttons to document
    canvas.parentNode.appendChild(controlBtnsContainer);
  }

  /* ================ EVENT HANDLERS ================ */

  /**
  *   Game control buttons click handler
  */
  function handleControlBtnClick(e) {
    e.target.blur();
    switch (e.target.dataset.action) {
      case "playPause":
        var isPlaying = playPause();
        e.target.innerHTML = isPlaying ? "Pause" : "Resume";
        e.target.className = isPlaying ? "button transition" : "blinking button transition";
      break;
      case "step":
        step();
        e.target.parentNode.querySelector('[data-action=playPause]').innerHTML = "Resume";
        e.target.parentNode.querySelector('[data-action=playPause]').className = "blinking button transition";
      break;
      case "stop":
        stop();
        e.target.dataset.action = "reset";
        e.target.innerHTML = "Clear";
        e.target.parentNode.querySelector('[data-action=playPause]').innerHTML = "Start";
        e.target.parentNode.querySelector('[data-action=playPause]').className = "blinking button transition";
      break;
      case "reset":
        reset(true);
        e.target.dataset.action = "stop";
        e.target.innerHTML = "Reset";
        e.target.parentNode.querySelector('[data-action=playPause]').innerHTML = "Start";
        e.target.parentNode.querySelector('[data-action=playPause]').className = "blinking button transition";
      break;
    }
  }

  /**
  *   Draws a cell when user clicks on canvas.
  *   Register a mousemove listener so user can hold
  *   button and continue to draw cells.
  *   When user releases mouse button, stop drawing by
  *   removing mousemove listener.
  */
  function handleMouseDown(e) {
    drawCell(e);
    e.target.addEventListener('mousemove', drawCell);
    e.target.addEventListener('mouseup', function() {
      e.target.removeEventListener('mousemove', drawCell);
    });
  }

  /**
  *   User has chosen a file to use as starting point
  *   for the simulation.
  */
  function handleImageUpload(e) {
    var fileReader = new FileReader();
    fileReader.onload = function(event){
      var img = new Image();
      img.addEventListener('load', function() {

        switch (e.target.files[0].type) {
          case "image/gif":
            // Treat this as a bitmap, which should not be scaled
            livingCells = importBitmap(img);
            draw();
          break;
          case "image/jpg":
          case "image/jpeg":
          case "image/png":
            // Treat as photo
            livingCells = cellify(img);
            draw();
          break;
          default:
            console.error("This file type is not supported: " + e.target.files[0].type);
          break;
        }
      });
      img.src = event.target.result;
    };
    fileReader.readAsDataURL(e.target.files[0]);
  }

  /* ================ IMAGE MANIPULATION ================ */
  /**
  *   Convert img to Grid, where dark pixels become living
  *   cells and bright pixels become dead cells. This is
  */
  function importBitmap(img) {
    var newGrid = new Grid();
    var hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = img.width;
    hiddenCanvas.height = img.height;
    var offsetX = Math.ceil((((canvas.width - img.width) / 2) / cellSize) - (2 * (marginBuffer / marginBufferMultiplier)));
    var offsetY = Math.ceil((((canvas.height - img.height) / 2) / cellSize) - (2 * (marginBuffer / marginBufferMultiplier)));
    var hiddenCtx = hiddenCanvas.getContext('2d');
    hiddenCtx.fillStyle = "#FFF";
    hiddenCtx.fillRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    hiddenCtx.drawImage(img, 0, 0);
    var imgData = hiddenCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    var data = imgData.data;
    // Loop through pixels and check average brightness.
    var x = 0;
    var y = 0;
    for (var i = 0; i < data.length; i += 4) {
      var avgColor = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avgColor < (255 / 2)) {
        // Dark pixel, make a living cell
        // Note that x and y is swapped, to prevent image
        // from being rotated.
        newGrid.spawn([[1]], y + offsetX, x + offsetY);
      }
      if (y >= img.width - 1) {
        x++;
        y = 0;
      } else {
        y++;
      }
    }
    return newGrid;
  }

  /**
  *   Convert img to Grid, where dark pixels become living
  *   cells and bright pixels become dead cells. This is
  *   an experimental feature, where user can upload a photo
  *   or similar and see what happens.
  *
  *   Note: Use importBitmap() to upload custom made pixel
  *   maps instead.
  */
  function cellify(img) {
    var newGrid = new Grid();
    var hiddenCanvas = document.createElement('canvas');
    // Scale image as big as possible, without losing any
    // pixels. 
    var widthRatio = (nrOfCells.xAxis - (2 * marginBufferMultiplier)) / img.width;
    var heightRatio = (nrOfCells.yAxis - (2 * marginBufferMultiplier)) / img.height;

    var ratio = Math.min(widthRatio, heightRatio);
    var scaledWidth = img.width * ratio;
    var scaledHeight = img.height * ratio;

    hiddenCanvas.width = scaledWidth;
    hiddenCanvas.height = scaledHeight;
    var hiddenCtx = hiddenCanvas.getContext('2d');
    hiddenCtx.mozImageSmoothingEnabled = false;
    hiddenCtx.webkitImageSmoothingEnabled = false;
    hiddenCtx.msImageSmoothingEnabled = false;
    hiddenCtx.imageSmoothingEnabled = false;
    hiddenCtx.fillStyle = "#FFF";
    hiddenCtx.fillRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    hiddenCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
    var imgData = hiddenCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    var data = imgData.data;
    // Loop through pixels and check average brightness.
    var x = 0;
    var y = 0;
    for (var i = 0; i < data.length; i += 4) {
      var avgColor = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (avgColor < (255 / 2)) {
        // Dark pixel, make a living cell
        // Note that x and y is swapped, to prevent image
        // from being rotated.
        newGrid.spawn([[1]], y, x);
      }
      if (y >= scaledWidth - 1) {
        x++;
        y = 0;
      } else {
        y++;
      }
    }
    return newGrid;
  }

  /* ================ CELL RENDERING ================ */

  /**
  *   Create starting point for the simulation.
  */
  function seed() {
    seedObject("glider_se", 40, 20);
    seedObject("square", 50, 27);
    seedObject("glider_nw", 70, 40);
    seedObject("square", 60, 33);
  }

  /**
  *   Draw cell when user clicks on canvas
  */
  function drawCell(e) {
    // Convert mouse x and y values to grid values.
    var cellX = Math.floor(e.offsetX / cellSize);
    var cellY = Math.floor(e.offsetY / cellSize);
    livingCells.spawn([[1]], cellX, cellY);
    draw();
  }

  /**
  *   Adds a cell figure to our `livingCells` grid.
  *   `type` is a String with the name of the figure
  *   `x` and `y` are the coordinates that the figure
  *   will be drawn to (figure's upper left corner).
  */
  function seedObject(type, x, y) {
    // Add Cells to livingCells
    switch(type) {
      // Basic square, two cells wide
      case "square":
        livingCells.spawn([
          [1, 1],
          [1, 1]
        ], x, y);
      break;
      // A glider that moves down and right (South East)
      case "glider_se":
        livingCells.spawn([
          [0, 1, 0],
          [0, 0, 1],
          [1, 1, 1]
        ], x, y);
      break;
      // A glider that moves up and left (North West)
      case "glider_nw":
        livingCells.spawn([
          [1, 1, 1],
          [1, 0, 0],
          [0, 1, 0]
        ], x, y);
      break;
      default:
        console.error("No such cell figure: " + type);
      break;
    }
  }

  /* ================ GAME CONTROLS ================ */

  /**
  *   Starts the game if paused or stopped. Pauses the game
  *   if it's running.
  */
  function playPause() {
    if (!timer) {
      // Start/continue game
      timer = setInterval(function() {
        main();
      }, frameInterval);
      return true;
    }else{
      // Pause game
      pause();
      return false;
    }
  }

  /**
  *   Stops the game
  */
  function stop() {
    pause();
    reset();
  }

  /**
  *   Pauses the game by resetting timer
  */
  function pause() {
    clearInterval(timer);
    timer = undefined;
  }

  /**
  *   Evolve one generation
  */
  function step() {
    clearInterval(timer);
    timer = undefined;
    main();
  }

  /**
  *   Resets the game by clearing canvas, seeding initial pixels and
  *   call draw to update game area. An optional argument `clear` can
  *   be used to completely empty the game area. If omitted, the
  *   initial seed will be rendered.
  */
  function reset(clear) {
    c.clearRect(0, 0, width, height);
    livingCells = new Grid();
    if (!clear) {
      seed();
    }
    draw();
  }

  /* ================ GAME LOOP ================ */
  /**
  *   `main` is responsible for calculating the next frame
  *   and then update (draw) the game area. It gets called in
  *   intervals when user clicks play.
  */
  function main() {
    calculateNextGeneration();
    draw();
  }

  /**
  *   Update grid based on John Conway's game rules.
  *
  *   DISCUSSION:
  *   The basic idea is that we will first check if cells
  *   that are alive will stay alive to the next generation.
  *   While we are doing that, we'll save all those cells' dead
  *   neighbours in an array called `mightComeAlive`.
  *   We then check if any cells in that array will come alive.
  *
  *   This function will modify our `livingCells` property.
  */
  function calculateNextGeneration() {
    var mightComeAlive = [];
    var nextGeneration = new Grid();
    // Check all living cells
    for (var x in livingCells) {
      for (var y in livingCells[x]) {
        var cell = livingCells[x][y];
        var neighbours = getNeighbours(cell);
        mightComeAlive = mightComeAlive.concat(neighbours.dead);
        var willSurvive = neighbours.living.length > 1 && neighbours.living.length < 4;
        if (willSurvive) {
          if (nextGeneration[cell.x] === undefined) {
            nextGeneration[cell.x] = [];
          }
          nextGeneration[cell.x][cell.y] = cell;
        }
      }
    }
    // Check dead cells
    mightComeAlive.forEach(function(cell) {
      if (getNeighbours(cell).living.length == 3) {
        if (nextGeneration[cell.x] === undefined) {
          nextGeneration[cell.x] = [];
        }
        nextGeneration[cell.x][cell.y] = cell;
      }
    });
    // Update the grid
    livingCells = nextGeneration;
  }

  /**
  *   Clear canvas and draw all living cells.
  */
  function draw() {
    c.clearRect(0, 0, width, height);
    for (var x in livingCells) {
      for (var y in livingCells[x]) {
        var cell = livingCells[x][y];
        var xPos = cell.x * cellSize;
        var yPos = cell.y * cellSize;
        c.fillRect(xPos, yPos, cellSize, cellSize);
      }
    }
  }

  /* ================ HELPER METHODS ================ */
  /**
  *   Return all neighbouring Cells and sort them
  *   by dead or alive
  */
  function getNeighbours(cell) {
    var result = {
      living: [],
      dead: []
    };
    for (var col = -1; col <= 1; col++) {
      for (var row = -1; row <= 1; row++) {
        if (!(row === 0 && col === 0)) {
          if (livingCells[cell.x + col] !== undefined && livingCells[cell.x + col][cell.y + row] !== undefined) {
            result.living.push(livingCells[cell.x + col][cell.y + row]);
          } else {
            result.dead.push(new Cell(cell.x + col, cell.y + row));
          }
        }
      }
    }
    return result;    
  }

  /**
  *   Given an array of objects, createElements will create buttons,
  *   collect them in a div and return the div.
  *   Object can have these properties:
  *   `text`     : A String that will be the elements innerHTML
  *   `action`   : A String that represents a public function. 
  *   `className`: A String with css classes
  */
  function createElements(elements) {
    var container = document.createElement('div');
    elements.forEach(function(element) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = element.className ? element.className + ' button transition' : 'button transition';
      el.dataset.action = element.action;
      el.innerHTML = element.text;
      container.appendChild(el);
    });
    return container;
  }

  /* ================ PUBLIC METHODS ================ */
  /**
  *   Initialize the game, passing optional settings object.
  */
  return {
    init: function(settings) {
      // Set instance variables
      cellSize = settings.cellSize || 10;
      marginBuffer = cellSize * marginBufferMultiplier;
      fps = settings.fps || 10;
      frameInterval = 1000 / fps;
      showTrails = settings.showTrails || false;
      // Setup game arena
      setup(settings.canvasId);
      // Seed first generation
      seed();
      // Draw first generation to canvas
      draw();
    }
  };
})();


// When DOM is ready...
window.onload = function() {
  // Init the game (with optional settings)
  gameOfLife.init({
    canvasId: 'game',
    cellSize: 8,
    fps: 15
  });
};






