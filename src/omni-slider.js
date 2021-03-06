/* Constructor function
 * elementContainer - this acts as a wrapper for the slider, all of the sliders DOM elements will be transcluded inside the <element> provided
 * options - contains the options for the slider
 */
function Slider(elementContainer, options) {
  'use strict';

  // Validation of element, the only required argument
  if (!elementContainer || (elementContainer.nodeName !== 'DIV' && elementContainer.tagName !== 'DIV')) return;

  // Contains IE8 information for the slider
  this.isIE8 = false;

  // Contains the options for this slider
  this.options = {
    isOneWay: null,
    isDate: null,
    overlap: null,
    min: null,
    max: null,
    start: null,
    end: null
  }

  // Custom Logic for 1 way
  var oneWay = false;
  if (options.isOneWay) {
    options.isOneWay = false;
    options.overlap = true;
    if (options.start && !options.end) {
      options.end = options.start;
    }
    options.start = null;
    oneWay = true;
  }

  // Handles this.options creation and options initialization
  this.init(options);

  // Contain pub/sub listeners
  this.topics = {
    start: [],
    moving: [],
    stop: []
  };

  // Contains the DOM elements for the slider
  this.UI = {
    slider: null,
    hanldeLeft: null,
    handleRight: null,
    fill: null
  };

  // Slider element
  var sliderElem = document.createElement('div');
  if (oneWay) {
    sliderElem.className = 'slider one-way';
  } else {
    sliderElem.className = 'slider';
  }
  this.UI.slider = sliderElem;

  // Left handle
  var handleLeft = document.createElement('div');
  handleLeft.className = 'handle handle-left';
  var circleLeft = document.createElement('div');
  circleLeft.className = 'slider-circle';
  handleLeft.appendChild(circleLeft);
  this.UI.handleLeft = handleLeft;
  this.UI.slider.appendChild(this.UI.handleLeft);

  // Right handle
  var handleRight = document.createElement('div');
  handleRight.className = 'handle handle-right';
  var circleRight = document.createElement('div');
  circleRight.className = 'slider-circle';
  handleRight.appendChild(circleRight);
  this.UI.handleRight = handleRight;
  this.UI.slider.appendChild(this.UI.handleRight);

  // Fill element
  var fill = document.createElement('div');
  fill.className = 'slider-fill';
  this.UI.fill = fill;
  this.UI.slider.appendChild(this.UI.fill);

  elementContainer.appendChild(this.UI.slider);

  // Move handles to have it's center as the end pointer point
  this.UI.handleLeft.style.marginLeft = '-' + (handleLeft.offsetWidth / 2) + 'px';
  this.UI.handleRight.style.marginRight = '-' + (handleRight.offsetWidth / 2) + 'px';

  // Push elements to starting positions
  var data = {
    left: this.options.start,
    right: this.options.end
  };
  this.move.bind(this)(data, true);

  // Bind events to start listening
  this.startingHandler = this.starting.bind(this);
  this.UI.handleLeft.onmousedown = this.startingHandler;
  this.UI.handleLeft.ontouchstart = this.startingHandler;
  this.UI.handleRight.onmousedown = this.startingHandler;
  this.UI.handleRight.ontouchstart = this.startingHandler;
}

/* Default config
 * isOneWay (Boolean denotes if slider only has one handle)
 * isDate (Boolean denotes if returning a moment wrapped value)
 * overlap (Boolean denotes if handles will overlap or just sit next to each other)
 * min and max (isDate ? typeof String [yyyy-mm-ddThh:mm] : typeof Number) - bounds
 * start and end (isDate ? typeof String [yyyy-mm-ddThh:mm] : typeof Number) - starting position
 */
Slider.prototype.defaultOptions = {
  isOneWay: false,
  isDate: false,
  overlap: false,
  min: 0,
  max: 100
};

/* Helper method (replace with shared function from library) */
Slider.prototype.extend = function(defaults, options) {
  var extended = {};
  var prop;
  for (prop in defaults) {
    if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
      extended[prop] = defaults[prop];
    }
  }

  for (prop in options) {
    if (Object.prototype.hasOwnProperty.call(options, prop)) {
      extended[prop] = options[prop];
    }
  }

  return extended;
};

// Initialize options and browser sniffing
Slider.prototype.init = function(options) {
  // Extend default options
  if (typeof options === 'object') {
    this.options = this.extend(this.defaultOptions, options);
  } else {
    this.options = this.defaultOptions;
  }

  // Check browser
  this.isIE8 = /MSIE/.test(navigator.userAgent);

  // Default start/end
  this.options.start = this.options.start || this.options.min;
  this.options.end = this.options.end || this.options.max;

  // Handle currency vs date type sanitization
  if (this.options.isDate) {
    this.options.max = new Date(this.options.max).valueOf();
    this.options.min = new Date(this.options.min).valueOf();

    // Check if max and min are proper
    if (this.options.max < this.options.min) {
      this.options.min = this.options.max;
    }

    // Check if start and end are within bounds
    if (typeof this.options.start !== 'undefined' &&
      typeof this.options.end !== 'undefined' &&
      this.options.start <= this.options.end &&
      new Date(this.options.start).valueOf() >= this.options.min &&
      new Date(this.options.end).valueOf() <= this.options.max) {
      this.options.start = new Date(this.options.start).valueOf();
      this.options.end = new Date(this.options.end).valueOf();
    } else {
      this.options.start = new Date(this.options.min).valueOf();
      this.options.end = new Date(this.options.max).valueOf();
    }
  } else {
    this.options.max = parseFloat(this.options.max);
    this.options.min = parseFloat(this.options.min);

    // Check if max and min are proper
    if (this.options.max < this.options.min) {
      this.options.min = this.options.max;
    }

    // Check if start and end are within bounds
    if (typeof this.options.start !== 'undefined' &&
      typeof this.options.end !== 'undefined' &&
      this.options.start <= this.options.end &&
      this.options.start >= this.options.min &&
      this.options.end <= this.options.max) {
      this.options.start = parseFloat(this.options.start);
      this.options.end = parseFloat(this.options.end);
    } else {
      this.options.start = this.options.min;
      this.options.end = this.options.max;
    }
  }
};

/* Provide information about the slider value
 * Returns an Object with property left and right denoting left and right values */
Slider.prototype.getInfo = function() {
  var info = {};
  var total = this.options.max - this.options.min;
  var left = this.UI.fill.style.left ? parseFloat(this.UI.fill.style.left.replace('%', '')) : 0;
  var right = this.UI.fill.style.right ? parseFloat(this.UI.fill.style.right.replace('%', '')) : 0;

  if (this.options.isDate) {
    info = {
      left: new Date(this.options.min + (left / 100) * total),
      right: new Date(this.options.max - (right / 100) * total)
    };
  } else {
    info = {
      left: this.options.min + (left / 100) * total,
      right: this.options.max - (right / 100) * total
    };
  }

  return info;
};

/* When handle is pressed
 * Attach all the necessary event handlers */
Slider.prototype.starting = function(event) {
  // Exit if disabled
  if (this.isDisabled) return;

  var x = 0;
  var y = 0;

  // Initialize drag object
  this.dragObj = {};

  // Get handle element node not the child nodes
  // If this is a child of the parent try to find the handle element
  if (this.isIE8) {
    this.dragObj.elNode = window.event.srcElement;

    while (this.dragObj.elNode.getAttribute('class').indexOf('handle') < 0) {
      this.dragObj.elNode = this.dragObj.elNode.parentNode;
    }
  } else {
    this.dragObj.elNode = event.target;

    while (!this.dragObj.elNode.classList.contains('handle')) {
      this.dragObj.elNode = this.dragObj.elNode.parentNode;
    }
  }

  // Direction where the slider control is going
  if (this.isIE8) {
    this.dragObj.dir = (this.dragObj.elNode.getAttribute('class').indexOf('handle-left') >= 0) ? 'left' : 'right';
  } else {
    this.dragObj.dir = this.dragObj.elNode.classList.contains('handle-left') ? 'left' : 'right';
  }

  // Get cursor position wrt the page
  if (this.isIE8) {
    x = window.event.clientX + document.documentElement.scrollLeft + document.body.scrollLeft;
    y = window.event.clientY + document.documentElement.scrollTop + document.body.scrollTop;
  } else {
    // If touch screen (event.touches) and if IE11 (pageXOffset)
    x = (typeof event.clientX !== 'undefined' ? event.clientX : event.touches[0].pageX) + (window.scrollX || window.pageXOffset);
    y = (typeof event.clientY !== 'undefined' ? event.clientY : event.touches[0].pageY) + (window.scrollY || window.pageYOffset);
  }

  // Save starting positions of cursor and element
  this.dragObj.cursorStartX = x;
  this.dragObj.cursorStartY = y;
  this.dragObj.elStartLeft = parseFloat(this.dragObj.elNode.style.left);
  this.dragObj.elStartRight = parseFloat(this.dragObj.elNode.style.right);
  if (isNaN(this.dragObj.elStartLeft)) this.dragObj.elStartLeft = 0;
  if (isNaN(this.dragObj.elStartRight)) this.dragObj.elStartRight = 0;

  // Update element's positioning for z-index
  // The element last moved will have a higher positioning
  if (this.isIE8) {
    this.UI.handleLeft.setAttribute('class', this.UI.handleLeft.getAttribute('class').replace('ontop', '').replace(/^\s+|\s+$/g, ''));
    this.UI.handleRight.setAttribute('class', this.UI.handleRight.getAttribute('class').replace('ontop', '').replace(/^\s+|\s+$/g, ''));

    this.dragObj.elNode.setAttribute('class', this.dragObj.elNode.getAttribute('class') + ' ontop');
  } else {
    this.UI.handleLeft.classList.remove('ontop');
    this.UI.handleRight.classList.remove('ontop');

    this.dragObj.elNode.classList.add('ontop');
  }

  // Capture mousemove and mouseup events on the page
  this.movingHandler = this.moving.bind(this);
  this.stopHandler = this.stop.bind(this);
  if (this.isIE8) {
    document.attachEvent('onmousemove', this.movingHandler);
    document.attachEvent('onmouseup', this.stopHandler);
  } else {
    document.addEventListener('mousemove', this.movingHandler, true);
    document.addEventListener('mouseup', this.stopHandler, true);
    document.addEventListener('touchmove', this.movingHandler, true);
    document.addEventListener('touchend', this.stopHandler, true);
  }

  // Stop default events
  this.stopDefault.bind(this)(event);
  if (this.isIE8) {
    this.UI.fill.setAttribute('class', this.UI.fill.getAttribute('class').replace('slider-transition', '').replace(/^\s+|\s+$/g, ''));
    this.UI.handleLeft.setAttribute('class', this.UI.handleLeft.getAttribute('class').replace('slider-transition', '').replace(/^\s+|\s+$/g, ''));
    this.UI.handleRight.setAttribute('class', this.UI.handleRight.getAttribute('class').replace('slider-transition', '').replace(/^\s+|\s+$/g, ''));
  } else {
    this.UI.fill.classList.remove('slider-transition');
    this.UI.handleLeft.classList.remove('slider-transition');
    this.UI.handleRight.classList.remove('slider-transition');
  }

  // Pub/sub lifecycle - start
  this.publish('start', this.getInfo());
};

/* When handle is being moved */
Slider.prototype.moving = function(event) {
  // Get cursor position with respect to the page
  var x = 0;
  var y = 0;
  if (this.isIE8) {
    x = window.event.clientX + document.documentElement.scrollLeft + document.body.scrollLeft;
    y = window.event.clientY + document.documentElement.scrollTop + document.body.scrollTop;
  } else {
    x = (typeof event.clientX !== 'undefined' ? event.clientX : event.touches[0].pageX) + (window.scrollX || window.pageXOffset);
    y = (typeof event.clientY !== 'undefined' ? event.clientY : event.touches[0].pageY) + (window.scrollY || window.pageYOffset);
  }

  // Move drag element by the same amount the cursor has moved
  var sliderWidth = this.UI.slider.offsetWidth;
  var calculatedVal = 0;
  if (this.dragObj.dir === 'left') {
    calculatedVal = this.dragObj.elStartLeft + ((x - this.dragObj.cursorStartX) / sliderWidth * 100);
  } else if (this.dragObj.dir === 'right') {
    calculatedVal = this.dragObj.elStartRight + ((this.dragObj.cursorStartX - x) / sliderWidth * 100);
  }

  // Keep handles within range
  if (calculatedVal < 0) {
    calculatedVal = 0;
  } else if (calculatedVal > 100) {
    calculatedVal = 100;
  }

  // Sanitize to work for both directions
  // Since we are adding to left and right there should not be a negative number
  calculatedVal = Math.abs(calculatedVal);

  // Take into account the handle when calculating space left
  var handleOffset = 0;
  if (!this.options.overlap) {
    handleOffset = (this.UI.handleRight.offsetWidth / this.UI.slider.offsetWidth) * 100;
  }

  // Add movement based on handle direction
  var remaining = 0;
  if (this.dragObj.dir === 'left') {
    remaining = (100 - handleOffset) - this.UI.fill.style.right.replace('%', '');
    if (remaining <= calculatedVal) {
      calculatedVal = remaining;
    }

    this.dragObj.elNode.style.left = calculatedVal + '%';
    this.UI.fill.style.left = calculatedVal + '%';
  } else {
    remaining = (100 - handleOffset) - this.UI.fill.style.left.replace('%', '');
    if (remaining <= calculatedVal) {
      calculatedVal = remaining;
    }

    this.dragObj.elNode.style.right = calculatedVal + '%';
    this.UI.fill.style.right = calculatedVal + '%';
  }

  // Stop default events
  this.stopDefault.bind(this)(event);

  // Pub/sub lifecycle - moving
  this.publish('moving', this.getInfo());
};

/* When handle is blured - do clean up */
Slider.prototype.stop = function(event) {
  // Stop capturing mousemove and mouseup events
  if (this.isIE8) {
    document.detachEvent('onmousemove', this.movingHandler);
    document.detachEvent('onmouseup', this.stopHandler);
  } else {
    document.removeEventListener('mousemove', this.movingHandler, true);
    document.removeEventListener('mouseup', this.stopHandler, true);
    document.removeEventListener('touchmove', this.movingHandler, true);
    document.removeEventListener('touchend', this.stopHandler, true);
  }

  // Stop default events
  this.stopDefault.bind(this)(event);

  // Pub/sub lifecycle - stop
  this.publish('stop', this.getInfo());
};

/* Push elements to position based on data */
Slider.prototype.move = function(data, preventPublish) {

  // Transition effects (cleaned up at Slider.prototype.starting);
  if (this.isIE8) {
    this.UI.fill.setAttribute('class', this.UI.fill.getAttribute('class') + ' slider-transition');
  } else {
    this.UI.fill.classList.add('slider-transition');
    this.UI.handleLeft.classList.add('slider-transition');
    this.UI.handleRight.classList.add('slider-transition');
  }

  var total = this.options.max - this.options.min;

  if (typeof data === 'object') {
    if (data.left) {
      if (data.left < this.options.min) data.left = this.options.min;
      if (data.left > this.options.max) data.left = this.options.max;

      var posLeft = (data.left - this.options.min) / total * 100;
      this.UI.handleLeft.style.left = posLeft + '%';
      this.UI.fill.style.left = posLeft + '%';
    }

    if (data.right) {
      if (data.right < this.options.min) data.right = this.options.min;
      if (data.right > this.options.max) data.right = this.options.max;

      var posRight = (this.options.max - data.right) / total * 100;
      this.UI.handleRight.style.right = posRight + '%';
      this.UI.fill.style.right = posRight + '%';
    }

    // If overlap is not enabled then check if the starting positions are overlapping - reset to full
    if (!this.options.overlap && this.UI.handleLeft.offsetLeft + this.UI.handleLeft.offsetWidth > this.UI.handleRight.offsetLeft - 1) {
      this.UI.fill.style.left = '0%';
      this.UI.fill.style.right = '0%';
      this.UI.handleLeft.style.left = '0%';
      this.UI.handleRight.style.right = '0%';
    }
  } else if (!isNaN(data)) {
    if (data < this.options.min) data = this.options.min;
    if (data > this.options.max) data = this.options.max;

    var pos = (data - this.options.min) / total * 100;
    this.UI.handleLeft.style.left = pos + '%';
    this.UI.fill.style.left = '0%';
    this.UI.fill.style.right = (100 - pos) + '%';
  }

  // Pub/sub lifecycle - moving
  if (!preventPublish) {
    this.publish('moving', this.getInfo());
  }
}

/* Utility function to stop default events */
Slider.prototype.stopDefault = function(event) {
  if (this.isIE8) {
    window.event.cancelBubble = true;
    window.event.returnValue = false;
  } else {
    event.preventDefault();
  }
};

/* Accessor for disable property */
Slider.prototype.disable = function(boolean) {
  this.isDisabled = boolean;
  if (this.isDisabled) {
    if (this.isIE8) {
      this.UI.slider.setAttribute('class', this.UI.slider.getAttribute('class') + ' slider-disabled');
    } else {
      this.UI.slider.classList.add('slider-disabled');
    }
  } else {
    if (this.isIE8) {
      this.UI.slider.setAttribute('class', this.UI.slider.getAttribute('class').replace('slider-disabled', '').replace(/^\s+|\s+$/g, ''));
    } else {
      this.UI.slider.classList.remove('slider-disabled');
    }
  }
};

/* Subscribe hook
 * Topic - keyword (start, moving, end)
 * Listener - function that will be called when topic is fired with argument of getInfo() data
 */
Slider.prototype.subscribe = function(topic, listener) {
  // Check validity of topic and listener
  if (!this.topics.hasOwnProperty.call(this.topics, topic) || typeof topic !== 'string' || typeof listener !== 'function') return;

  // Add the listener to queue
  // Retrieve the index for deletion
  var index = this.topics[topic].push(listener) - 1;

  // Return instance of the subscription for deletion
  return {
    remove: (function() {
      delete this.topics[topic][index];
    }).bind(this)
  };
};

/* Publish hook
 * Topic - keyword (start, moving, end)
 * Data - getInfo() result to pass into the listener
 */
Slider.prototype.publish = function(topic, data) {
  // Check validity of topic
  if (!this.topics.hasOwnProperty.call(this.topics, topic) || typeof topic !== 'string') return;

  // Cycle through events in the queue and fire them with the slider data
  this.topics[topic].forEach(function(event) {
    event(data);
  });
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = Slider;
} else {
  window.Slider = Slider;
}
