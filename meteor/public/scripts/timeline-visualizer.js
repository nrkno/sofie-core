(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.TimelineVisualizer = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
tslib_1.__exportStar(require("./lib/timelineVisualizer"), exports);

},{"./lib/timelineVisualizer":2,"tslib":13}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isEqual = require("lodash.isequal");
const superfly_timeline_1 = require("superfly-timeline");
const events_1 = require("events");
/** Step size/ time step. */
const DEFAULT_STEP_SIZE = 1;
/** Width of label column. */
const LABEL_WIDTH_OF_TIMELINE = 0.25;
/** Default zoom */
const DEFAULT_ZOOM_VALUE = 100;
/** Factor to zoom by */
const ZOOM_FACTOR = 1.001;
/** Factor to pan by (pan = PAN_FACTOR * STEP_SIZE) */
const PAN_FACTOR = 10;
/** Maximum layer height */
const MAX_LAYER_HEIGHT = 60;
/** Amount to move playhead per second. */
const DEFAULT_PLAYHEAD_SPEED = 1;
/** BEGIN STYLING VALUES */
/** Timeline background color. */
const COLOR_BACKGROUND = '#333333';
/** Layer label background color. */
const COLOR_LABEL_BACKGROUND = '#666666';
/** Color of the ruler lines */
const RULER_LINE_COLOR = '#999999';
/** Width of the ruler lines */
const RULER_LINE_WIDTH = 1;
/** Playhead color. */
const COLOR_PLAYHEAD = 'rgba(255, 0, 0, 0.5)';
/** Playhead thickness. */
const THICKNESS_PLAYHEAD = 5;
/** Color of line separating timeline rows. */
const COLOR_LINE = 'black';
/** Height of line separating rows. */
const THICKNESS_LINE = 1;
/** Text properties. */
const TEXT_FONT_FAMILY = 'Calibri';
const TEXT_FONT_SIZE = 16;
const TEXT_COLOR = 'white';
/** Timeline object properties. */
const COLOR_TIMELINE_OBJECT_FILL = 'rgb(22, 102, 247, 0.75)';
const COLOR_TIMELINE_OBJECT_BORDER = 'rgba(232, 240, 255, 0.85)';
const THICKNESS_TIMELINE_OBJECT_BORDER = 1;
/** Timeline object height as a proportion of the row height. */
const TIMELINE_OBJECT_HEIGHT = 1;
/** END STYLING VALUES */
/** BEGIN CONSTANTS FOR STATE MANAGEMENT */
const MOUSEIN = 0;
const MOUSEOUT = 1;
class TimelineVisualizer extends events_1.EventEmitter {
    /**
     * @param {string} canvasId The ID of the canvas object to draw within.
     */
    constructor(canvasId, options = {}) {
        super();
        // Step size.
        this.stepSize = DEFAULT_STEP_SIZE;
        /** @private @readonly Proportion of the canvas to be used for the layer labels column. */
        this._layerLabelWidthProportionOfCanvas = LABEL_WIDTH_OF_TIMELINE;
        /** Layers on timeline. */
        this._layerLabels = {};
        /** State of the timeline. */
        this._timelineState = {};
        /** Map of objects for determining hovered object */
        this._hoveredObjectMap = {};
        /** Start time of the current view. Defines the objects within view on the timeline [time] */
        this._viewStartTime = 0;
        /** Range of the current view [time] */
        // private _viewTimeRange: number = 1
        // private _drawTimeEnd: number
        /** Store whether the mouse is held down, for scrolling. */
        this._mouseDown = false;
        /** Current zoom amount. */
        this._timelineZoom = DEFAULT_ZOOM_VALUE;
        /** Whether or not the playhead should move. */
        this._playHeadPlaying = false;
        /** Speed of the playhead [units / second] */
        this._playSpeed = DEFAULT_PLAYHEAD_SPEED;
        /** The current time position of the playhead. */
        this._playHeadTime = 0;
        /** The last time updateDraw() did a draw. */
        this._updateDrawLastTime = 0;
        /** Whether the mouse last moved over an object or out. */
        this._lastHoverAction = MOUSEOUT;
        /** Name of object that was last hovered over. */
        this._lastHoveredHash = '';
        /** If the visualizer automatically should re-resolve the timeline when navigating the viewport */
        this._timelineResolveAuto = false;
        /** At what time the timeline was resolved [time] */
        this._timelineResolveStart = 0;
        this._timelineResolveEnd = 0;
        this._timelineResolveZoom = 1;
        this._timelineResolveCount = 100;
        this._timelineResolveCountAdjust = 1;
        /** How much extra (outside the current viewport) the timeline should be resolved to [ratio] */
        this._timelineResolveExpand = 3;
        this.latestUpdateTime = 0;
        this.reresolveTimeout = null;
        this._mergeIterator = 0;
        // Initialise other values.
        this._canvasId = canvasId;
        this.initCanvas();
        this._drawPlayhead = !!options.drawPlayhead;
        // Calculate width of label column.
        this._layerLabelWidth = this._canvasWidth * this._layerLabelWidthProportionOfCanvas;
        // Calculate timeline width and start point.
        this._viewDrawX = this._layerLabelWidth;
        this._viewDrawWidth = this._canvasWidth - this._layerLabelWidth;
        // Draw background.
        this.drawBackground();
        // Draw playhead.
        this.drawPlayhead();
        this.updateDraw();
    }
    /**
     * Initialises the canvas and registers canvas events.
     */
    initCanvas() {
        // Create new canvas object.
        this._canvasContainer = document.getElementById(this._canvasId);
        if (!this._canvasContainer)
            throw new Error(`Canvas "${this._canvasId}" not found`);
        // Get rendering context.
        this._canvas = this._canvasContainer.getContext('2d');
        // Register canvas interaction event handlers.
        this._canvasContainer.addEventListener('mousedown', (event) => this.canvasMouseDown(event));
        this._canvasContainer.addEventListener('mouseup', (event) => this.canvasMouseUp(event));
        this._canvasContainer.addEventListener('mousemove', (event) => this.canvasMouseMove(event));
        this._canvasContainer.addEventListener('wheel', (event) => this.canvasScrollWheel(event));
        // Get width and height of canvas.
        this._canvasWidth = this._canvasContainer.width;
        this._canvasHeight = this._canvasContainer.height;
    }
    /**
     * Updates the timeline, should be called when actions are added/removed from a timeline
     * but the same timeline is being drawn.
     * @param {TimelineObject[]} timeline Timeline to draw.
     * @param {ResolveOptions} options Resolve options.
     */
    updateTimeline(timeline, options) {
        // If options have not been specified set time to 0.
        if (options === undefined) {
            options = {
                time: 0,
                limitCount: 10
            };
        }
        this.latestTimeline = timeline;
        this.latestOptions = options;
        if (!options.limitTime) {
            this._timelineResolveAuto = true;
        }
        else {
            this._timelineResolveAuto = false;
        }
        const options2 = Object.assign({}, options);
        if (this._timelineResolveAuto) {
            this.updateTimelineResolveWindow();
        }
        if (this._resolvedStates === undefined) { // If first time this runs
            // Set timeline start and end times.
            if (options2.time !== undefined) {
                this._viewStartTime = options2.time;
            }
            // Move playhead to start time.
            this._playHeadTime = this._viewStartTime;
        }
        this._updateTimeline(true);
    }
    _updateTimeline(fromNewTimeline = false) {
        const options2 = Object.assign({}, this.latestOptions);
        if (this._timelineResolveAuto) {
            options2.time = this._timelineResolveStart;
            options2.limitTime = this._timelineResolveEnd;
            options2.limitCount = Math.ceil(this._timelineResolveCount * this._timelineResolveCountAdjust);
        }
        // If the playhead is being drawn, the resolve time should be at the playhead time.
        if (this._drawPlayhead && this._playHeadTime > options2.time) {
            options2.time = this._playHeadTime;
        }
        // Resolve the timeline.
        const startResolve = Date.now();
        const resolvedTimeline = superfly_timeline_1.Resolver.resolveTimeline(this.latestTimeline, options2);
        let newResolvedStates = superfly_timeline_1.Resolver.resolveAllStates(resolvedTimeline);
        if (this._resolvedStates === undefined) { // If first time this runs
            this._resolvedStates = newResolvedStates;
        }
        else {
            if (this._drawPlayhead) {
                // Trim the current timeline:
                if (newResolvedStates) {
                    // Merge the timelines.
                    this._resolvedStates = this.mergeTimelineObjects(this._resolvedStates, newResolvedStates, fromNewTimeline);
                }
            }
            else {
                // Otherwise we only see one timeline at a time.
                // Overwrite the previous timeline:
                this._resolvedStates = newResolvedStates;
            }
        }
        // Update layers.
        this.updateLayerLabels();
        this.latestUpdateTime = Date.now() - startResolve;
        // Redraw the timeline.
        this.redrawTimeline();
        this.latestUpdateTime = Date.now() - startResolve;
    }
    /**
     * Sets the viewport to a position, zoom, and playback speed.
     * Playback speed currently not implemented.
     * @param viewPort Object to update viewport with.
     */
    setViewPort(viewPort) {
        // Whether the viewport has changed.
        let changed = false;
        // If zoom has been specified.
        if (viewPort.zoom !== undefined) {
            // Zoom to specified zoom.
            this._timelineZoom = viewPort.zoom;
            changed = true;
        }
        // If timestamp has been specified.
        if (viewPort.timestamp !== undefined) {
            // Set start time to specified time.
            if (viewPort.timestamp > 0) {
                this._viewStartTime = viewPort.timestamp;
                changed = true;
            }
        }
        if (viewPort.playViewPort !== undefined) {
            this._playViewPort = viewPort.playViewPort;
        }
        // If the playback speed has been set, set the new playback speed.
        if (viewPort.playSpeed !== undefined) {
            if (!this._drawPlayhead)
                throw new Error('setViewPort: viewPort.playSpeed was set, but drawPlayhead was not set in constructor');
            this._playSpeed = viewPort.playSpeed;
        }
        // Set playhead playing/ not playing.
        if (viewPort.playPlayhead !== undefined) {
            if (!this._drawPlayhead)
                throw new Error('setViewPort: viewPort.playPlayhead was set, but drawPlayhead was not set in constructor');
            this._playHeadPlaying = viewPort.playPlayhead;
        }
        if (viewPort.playheadTime !== undefined) {
            if (!this._drawPlayhead)
                throw new Error('setViewPort: viewPort.playheadTime was set, but drawPlayhead was not set in constructor');
            this._playHeadTime = Math.max(0, viewPort.playheadTime);
            if (this._playHeadTime > 0)
                this._updateDrawLastTime = this._playHeadTime;
            changed = true;
        }
        // Redraw timeline if anything has changed.
        if (changed === true) {
            this.redrawTimeline();
        }
    }
    /**
     * Accessor for polling the currently hovered over object.
     */
    getHoveredObject() {
        return this._hoveredOver;
    }
    /**
     * Calculates the height to give to each row to fit all layers on screen.
     * @param {String[]} layers Map of layers to use.
     * @returns Height of rows.
     */
    calculateRowHeight(layers) {
        return Math.min(MAX_LAYER_HEIGHT, this._canvasHeight / Object.keys(layers).length);
    }
    updateLayerLabels() {
        // Store layers to draw.
        const o = this.getLayersToDraw();
        if (!isEqual(this._layerLabels, o.layers)) {
            this._layerLabels = o.layers;
            // Calculate row height.
            this._rowHeight = this.calculateRowHeight(this._layerLabels);
            // Set timeline object height.
            this._timelineObjectHeight = this._rowHeight * TIMELINE_OBJECT_HEIGHT;
            this._numberOfLayers = Object.keys(this._layerLabels).length;
            this._rowsTotalHeight = this._rowHeight * this._numberOfLayers;
        }
    }
    /**
     * Draws the layer labels to the canvas.
     */
    drawLayerLabels() {
        let row = 0;
        // Iterate through layers.
        for (let layerName of Object.keys(this._layerLabels)) {
            this._canvas.fillStyle = COLOR_LABEL_BACKGROUND;
            this._canvas.fillRect(0, row * this._rowHeight, this._layerLabelWidth, this._rowHeight);
            this._canvas.fillStyle = TEXT_COLOR;
            this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY;
            this._canvas.textBaseline = 'middle';
            this._canvas.fillText(layerName, 0, (row * this._rowHeight) + (this._rowHeight / 2), this._layerLabelWidth);
            if (this._layerLabels[layerName] !== 0) {
                this._canvas.fillStyle = COLOR_LINE;
                this._canvas.fillRect(this._layerLabelWidth, row * this._rowHeight, this._viewDrawWidth, THICKNESS_LINE);
            }
            row++;
        }
    }
    /**
     * Draws the timeline background.
     */
    drawBackground() {
        this._canvas.fillStyle = COLOR_BACKGROUND;
        this._canvas.fillRect(0, 0, this._canvasWidth, this._canvasHeight);
        this.drawBackgroundRuler();
    }
    /**
     * Draw a ruler on top of background
     */
    drawBackgroundRuler() {
        const range = this.viewRange;
        const endTime = this.viewEndTime;
        const circaNumberOfLines = 5;
        const rounder = Math.pow(10, Math.floor(Math.log10(range / circaNumberOfLines))); // What to round the ruler to
        const rounderNext = rounder * 10;
        const numberOfLines = Math.floor(range / rounder);
        const rulerDiff = rounder;
        const startTime = Math.floor(this._viewStartTime / rounder) * rounder;
        const opacity = (Math.min(1, circaNumberOfLines / numberOfLines));
        if (rulerDiff) {
            this._canvas.strokeStyle = RULER_LINE_COLOR;
            this._canvas.lineWidth = RULER_LINE_WIDTH;
            for (let rulerTime = startTime; rulerTime < endTime; rulerTime += rulerDiff) {
                this._canvas.beginPath();
                let x = this.timeToXCoord(rulerTime);
                let distanceToNext = (rulerTime / rounderNext) % 1;
                if (distanceToNext > 0.5)
                    distanceToNext -= 1;
                distanceToNext = Math.abs(distanceToNext);
                if (distanceToNext < 0.01) {
                    // Is a significant line
                    this._canvas.globalAlpha = 1;
                }
                else {
                    this._canvas.globalAlpha = opacity;
                }
                if (x >= this._viewDrawX) {
                    this._canvas.moveTo(x, 0);
                    this._canvas.lineTo(x, this._canvasHeight);
                }
                this._canvas.stroke();
            }
            this._canvas.globalAlpha = 1;
        }
    }
    /**
     * Draws the playhead initially.
     */
    drawPlayhead() {
        // If the playhead should be draw.
        if (this._drawPlayhead) {
            if (this.istimeInView(this._playHeadTime)) {
                this._canvas.fillStyle = COLOR_PLAYHEAD;
                this._canvas.fillRect(this.timeToXCoord(this._playHeadTime), 0, THICKNESS_PLAYHEAD, this._canvasHeight);
            }
        }
    }
    /**
     * Gets the layers to draw from the timeline.
     */
    getLayersToDraw() {
        this._hoveredObjectMap = {};
        const layersArray = this._resolvedStates ? Object.keys(this._resolvedStates.layers) : [];
        layersArray.sort((a, b) => {
            if (a > b)
                return 1;
            if (a < b)
                return 1;
            return 0;
        });
        const layers = {};
        layersArray.forEach((layerName, index) => {
            layers[layerName] = index;
            this._hoveredObjectMap[layerName] = [];
        });
        return {
            layers: layers,
            layersArray: layersArray
        };
    }
    /**
     * Redraws the timeline to the canvas.
     */
    redrawTimeline() {
        this._canvas.clearRect(0, 0, this._canvasWidth, this._canvasHeight);
        this.drawBackground();
        this.drawLayerLabels();
        // Recompute objects positions
        this._timelineState = this.getTimelineDrawState(this._resolvedStates);
        // Draw the current state.
        this.drawTimelineState(this._timelineState);
        this.drawPlayhead();
        this.checkAutomaticReresolve();
    }
    /**
     * Draws a timeline state to the canvas.
     * @param {TimelineDrawState} currentDrawState State to draw.
     */
    drawTimelineState(currentDrawState) {
        for (let element in currentDrawState) {
            const drawState = currentDrawState[element];
            if (drawState.visible) {
                this._canvas.fillStyle = COLOR_TIMELINE_OBJECT_FILL;
                this._canvas.fillRect(drawState.left, drawState.top, drawState.width, drawState.height);
                this._canvas.strokeStyle = COLOR_TIMELINE_OBJECT_BORDER;
                this._canvas.lineWidth = THICKNESS_TIMELINE_OBJECT_BORDER;
                this._canvas.strokeRect(drawState.left, drawState.top, drawState.width, drawState.height);
                this._canvas.fillStyle = TEXT_COLOR;
                this._canvas.font = TEXT_FONT_SIZE.toString() + 'px ' + TEXT_FONT_FAMILY;
                this._canvas.textBaseline = 'top';
                this._canvas.fillText(drawState.title, drawState.left, drawState.top);
            }
        }
    }
    /**
     * Returns the draw states for all timeline objects.
     * @param {ResolvedStates} timeline Timeline to draw.
     * @returns {TimelineDrawState} State of time-based objects.
     */
    getTimelineDrawState(timeline) {
        let currentDrawState = {};
        if (timeline) {
            for (let objId in timeline.objects) {
                let timelineObj = timeline.objects[objId];
                for (let _i = 0; _i < timelineObj.resolved.instances.length; _i++) {
                    let instanceObj = timelineObj.resolved.instances[_i];
                    let name = 'timelineObject:' + objId + ':' + instanceObj.id;
                    currentDrawState[name] = this.createStateForObject(timelineObj, instanceObj.start, instanceObj.end);
                    if (currentDrawState[name].visible === true) {
                        if (!this._hoveredObjectMap[timelineObj.layer + ''])
                            this._hoveredObjectMap[timelineObj.layer + ''] = [];
                        this._hoveredObjectMap[timelineObj.layer + ''].push({
                            startX: currentDrawState[name].left,
                            endX: currentDrawState[name].left + currentDrawState[name].width,
                            objectRefId: objId,
                            instanceId: instanceObj.id,
                            type: 'timelineObject',
                            name: name
                        });
                    }
                }
            }
        }
        return currentDrawState;
    }
    /**
     * Creates a draw state for a timeline object.
     * @param {string} layer Object's layer.
     * @param {number} start Start time.
     * @param {number} end End time.
     * @returns {DrawState} State of the object to draw.
     */
    createStateForObject(obj, start, end) {
        // Default state (hidden).
        let state = {
            height: 0,
            left: 0,
            top: 0,
            width: 0,
            visible: false,
            title: 'N/A'
        };
        // State should be default if the object is not being shown.
        if (this.showOnTimeline(start, end)) {
            // Get object dimensions and position.
            let objectWidth = this.getObjectWidth(start, end);
            let xCoord = this.capXcoordToView(this.timeToXCoord(start));
            let objectTop = this.getObjectOffsetFromTop(obj.layer + '');
            // Set state properties.
            state.height = this._timelineObjectHeight;
            state.left = xCoord;
            state.top = objectTop;
            state.width = objectWidth;
            state.visible = true;
            state.title = obj.id;
        }
        return state;
    }
    /**
     * Calculates the offset, in pixels from the start of the timeline for an object.
     * @param {number} start start time of the object.
     * @returns {number} Offset in pixels.
     */
    // private getObjectOffsetFromTimelineStart (start: number): number {
    // 	// Calculate offset.
    // 	let offset = (start - this._viewStartTime) * this.pixelsWidthPerUnitTime
    // 	// Offset cannot be to the left of the timeline start position.
    // 	if (offset < 0) {
    // 		offset = 0
    // 	}
    // 	return offset
    // }
    /**
     * Calculates the width, in pixels, of an object based on its duration.
     * @param {number} start Start time of the object.
     * @param {number} end End time of the object.
     * @returns {number} Width in pixels.
     */
    getObjectWidth(startTime, endTime) {
        if (!endTime)
            return this._canvasWidth;
        // If the start time is less than the timeline start, set to timeline start.
        if (startTime < this._viewStartTime) {
            startTime = this._viewStartTime;
        }
        // Calculate duration of the object remaining on the timeline.
        let duration = endTime - startTime;
        // Return end point position in pixels.
        return duration * this.pixelsWidthPerUnitTime;
    }
    /**
     * Determines whether to show an object on the timeline.
     * @param {number} start Object start time.
     * @param {number} end Object end time.
     * @returns {true} if object should be shown on the timeline.
     */
    showOnTimeline(start, end) {
        let isAfter = start >= this.viewEndTime;
        let isBefore = (end || Infinity) <= this._viewStartTime;
        return !isAfter && !isBefore;
    }
    /**
     * Calculate position of object instance from top of timeline according to its layer.
     * @param {string} layer Object's layer.
     * @returns Position relative to top of canvas in pixels.
     */
    getObjectOffsetFromTop(layerName) {
        let top = this._layerLabels[layerName];
        return top * this._rowHeight;
    }
    /**
     * Moves the playhead. Called periodically.
     */
    updateDraw() {
        const now = Date.now();
        // How long time since last update:
        const dt = (this._updateDrawLastTime > 0 ?
            now - this._updateDrawLastTime :
            1) / 1000;
        this._updateDrawLastTime = now;
        const deltaTime = this._playSpeed * dt;
        // Check playhead should be drawn.
        let needRedraw = false;
        if (this._playHeadPlaying && this._drawPlayhead) {
            if (this._playViewPort &&
                this.istimeInView(this._playHeadTime) // Only play if playhead is in view
            ) {
                this._viewStartTime += deltaTime;
            }
            // Move playhead forward
            this._playHeadTime += deltaTime;
            needRedraw = true;
        }
        if (needRedraw) {
            this.redrawTimeline();
        }
        // call this function on next frame
        window.requestAnimationFrame(() => this.updateDraw());
    }
    /**
     * Handles mouse down event.
     * @param event Mouse event.
     */
    canvasMouseDown(event) {
        // Store mouse is down.
        this._mouseDown = true;
        // Store X position of mouse on click.
        this._mouseLastX = event.clientX;
        // Prevent event.
        event.preventDefault();
        event.stopPropagation();
    }
    /**
     * Handles mouse up event.
     * @param event Mouse event.
     */
    canvasMouseUp(event) {
        // Mouse no longer down.
        this._mouseDown = false;
        // Reset scroll direction.
        this._lastScrollDirection = 0;
        // Prevent event.
        event.preventDefault();
        event.stopPropagation();
    }
    /**
     * Handles mouse movement on canvas.
     * @param event Mouse event.
     */
    canvasMouseMove(event) {
        // If mouse is down.
        if (this._mouseDown) {
            // If we are beginning scrolling, we can move freely.
            if (this._lastScrollDirection === undefined || this._lastScrollDirection === 0) {
                // Store current mouse X.
                this._mouseLastX = event.clientX;
                // Calculate change in X.
                let deltaX = event.clientX - this._mouseLastX;
                // Store scrolling direction.
                if (deltaX < 0) {
                    this._lastScrollDirection = -1;
                }
                else {
                    this._lastScrollDirection = 1;
                }
                // Scroll to new X position.
                this.canvasScrollByDeltaX(-deltaX);
            }
            else {
                // Calculate scroll direction.
                let direction = this._mouseLastX - event.clientX;
                // If changing direction, store new direction but don't scroll.
                if (direction < 0 && this._lastScrollDirection === 1) {
                    this._mouseLastX = event.clientX;
                    this._lastScrollDirection = -1;
                }
                else if (direction > 0 && this._lastScrollDirection === -1) {
                    this._mouseLastX = event.clientX;
                    this._lastScrollDirection = 1;
                }
                else {
                    // Calculate change in X.
                    let deltaX = event.clientX - this._mouseLastX;
                    // Store last X position.
                    this._mouseLastX = event.clientX;
                    // Move by change in X.
                    this.canvasScrollByDeltaX(-deltaX);
                }
            }
            // Redraw timeline.
            this.redrawTimeline();
        }
        else {
            // Whether an object is under the cursor.
            let found = false;
            // Find the object that is currently hovered over.
            let mousePos = this.getMousePos(this._canvasContainer, event);
            if (mousePos.x > this._viewDrawX) {
                if (mousePos.y < this._rowsTotalHeight) {
                    let selectedRow = Math.floor((mousePos.y / this._rowsTotalHeight) * this._numberOfLayers);
                    let layer;
                    Object.keys(this._layerLabels).forEach(layerName => {
                        if (this._layerLabels[layerName] === selectedRow)
                            layer = layerName;
                    });
                    let hoverMapData = (layer ? this._hoveredObjectMap[layer] : []) || [];
                    hoverMapData.forEach(object => {
                        if (object.startX <= mousePos.x && object.endX >= mousePos.x) {
                            found = true;
                            const hoverHash = object.type + object.objectRefId + object.instanceId; // hash-ish
                            if (this._lastHoveredHash !== hoverHash) {
                                // Get object metadata from the object name of the hovered object.
                                // If we are hovering over a timeline object.
                                if (object.type === 'timelineObject') {
                                    // Get the timeline object and the instance being hovered over.
                                    if (this._resolvedStates) {
                                        let timelineObject = this._resolvedStates.objects[object.objectRefId];
                                        let instance = timelineObject.resolved.instances.find(instance => instance.id === object.instanceId);
                                        if (instance) {
                                            // Construct hover info.
                                            let hoverInfo = {
                                                object: timelineObject,
                                                instance: instance,
                                                pointer: { xPostion: mousePos.x, yPosition: mousePos.y }
                                            };
                                            // Set currently hovered object.
                                            this._hoveredOver = hoverInfo;
                                            // Emit event.
                                            this.emit('timeline:hover', { detail: this._hoveredOver });
                                        }
                                        // Store last items.
                                        this._lastHoverAction = MOUSEIN;
                                        this._lastHoveredHash = hoverHash;
                                    }
                                }
                            }
                        }
                    });
                }
            }
            // Emit undefined when mouse out.
            if (!found && this._lastHoverAction === MOUSEIN) {
                this.emit('timeline:hover', { detail: undefined });
                this._lastHoverAction = MOUSEOUT;
            }
        }
    }
    /**
     * Handles scroll wheel events on the canvas.
     * @param event Scroll event.
     */
    canvasScrollWheel(event) {
        // Get mouse pointer coordinates on canvas.
        let canvasCoord = this.getMousePos(this._canvasContainer, event);
        // Don't scroll if mouse is not over timeline.
        if (canvasCoord.x <= this._viewDrawX) {
            return;
        }
        let changed = false;
        // CTRL + scroll to zoom.
        if (event.ctrlKey === true) {
            if (event.deltaY) {
                changed = true;
                const zoomFactor = Math.pow(ZOOM_FACTOR, -event.deltaY);
                this.zoomUnderCursor(canvasCoord.x, zoomFactor);
            }
        }
        else if (event.deltaX !== 0) { // Scroll on x-axis
            changed = true;
            // Pan.
            this.canvasScrollByDeltaX((event.deltaX * (PAN_FACTOR * this.stepSize)));
        }
        else if (event.deltaY !== 0 && event.altKey === true) { // Also scroll on alt-key + scroll y-axis
            changed = true;
            // Pan.
            this.canvasScrollByDeltaX((event.deltaY * (PAN_FACTOR * this.stepSize)));
        }
        // Prevent event.
        event.preventDefault();
        event.stopPropagation();
        if (changed) {
            // Redraw timeline.
            this.redrawTimeline();
        }
    }
    /**
     * Scroll across the canvas by a specified X value.
     * @param {number} deltaX Value to move by.
     */
    canvasScrollByDeltaX(deltaX) {
        // Calculate new starting time.
        let targetStart = this._viewStartTime + (deltaX / this.pixelsWidthPerUnitTime);
        // Starting time cannot be < 0.
        if (targetStart < 0) {
            targetStart = 0;
        }
        // Optimisation, don't redraw if nothing has changed.
        if (targetStart === this._viewStartTime) {
            return;
        }
        this._viewStartTime = targetStart;
    }
    /**
     * Zooms into/out of timeline, keeping the time under the cursor in the same position.
     * @param cursorX Position of mouse cursor.
     */
    zoomUnderCursor(cursorX, zoomFactor) {
        // Point in time of the cursor
        let cursorTime = this.xCoordToTime(cursorX);
        // Ratio (in view range) of the cursor
        let cursorRatio = this.timeToRatio(cursorTime);
        // Change zoom:
        this._timelineZoom = this._timelineZoom * zoomFactor;
        // Limit within current view
        cursorRatio = Math.max(0, Math.min(1, cursorRatio));
        // Calculate start
        let targetStart = cursorTime - (cursorRatio * this.viewRange);
        // Start cannot be less than 0
        if (targetStart < 0) {
            targetStart = 0;
        }
        // Set draw time
        this._viewStartTime = targetStart;
    }
    /**
     * Gets the mouse position relative to the top-left of the canvas [pixels]
     * @param canvas
     * @param evt
     * @returns {x: number, y: number} Position.
     */
    getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }
    /**
     * Trims a timeline so that objects only exist within a specified time period.
     * @param timeline Timeline to trim.
     * @param trim Times to trim between.
     */
    trimTimeline(timeline, trim) {
        // The new resolved objects.
        let newObjects = {};
        // Iterate through resolved objects.
        Object.keys(timeline.objects).forEach((objId) => {
            const obj = timeline.objects[objId];
            const resultingInstances = [];
            obj.resolved.instances.forEach(instance => {
                // Whether to insert this object into the new timeline.
                let useInstance = false;
                let newInstance = Object.assign({}, instance); // clone
                // If trimming the start time.
                if (trim.start) {
                    // If the object ends after the trim start time.
                    if ((instance.end || Infinity) > trim.start) {
                        useInstance = true;
                        if (newInstance.start < trim.start) {
                            newInstance.start = trim.start;
                        }
                    }
                }
                // If trimming the end time.
                if (trim.end) {
                    // If the object starts before the trim end time.
                    if (instance.start < trim.end) {
                        useInstance = true;
                        if ((newInstance.end || Infinity) > trim.end) {
                            newInstance.end = trim.end;
                        }
                    }
                }
                if (!trim.start && !trim.end) {
                    useInstance = true;
                }
                if (useInstance &&
                    newInstance.start < (newInstance.end || Infinity)) {
                    resultingInstances.push(newInstance);
                }
            });
            // If there isn't a resolved object for the new instance, create it.
            if (!newObjects[objId]) {
                let newObject = {
                    content: obj.content,
                    enable: obj.enable,
                    id: obj.id,
                    layer: obj.layer,
                    resolved: {
                        instances: [],
                        levelDeep: obj.resolved.levelDeep,
                        resolved: obj.resolved.resolved,
                        resolving: obj.resolved.resolving
                    }
                };
                newObjects[objId] = newObject;
            }
            newObjects[objId].resolved.instances = resultingInstances;
        });
        return {
            classes: timeline.classes,
            layers: timeline.layers,
            objects: newObjects,
            options: timeline.options,
            statistics: timeline.statistics,
            state: timeline.state,
            nextEvents: timeline.nextEvents
        };
    }
    /**
     * Merges two timelines by merging instances of objects that intersect each other.
     * @param past Older timeline.
     * @param present Newer timeline.
     * @returns {ResolvedTimeline} containing merged timelines.
     */
    mergeTimelineObjects(past, present, fromNewTimeline) {
        const resultingObjects = {};
        if (fromNewTimeline) {
            past = this.trimTimeline(past, { end: this._playHeadTime });
            present = this.trimTimeline(present, { start: this._playHeadTime });
            // Because we want to keep old objects, this iterator is used to create unique old ids for them
            this._mergeIterator++;
            Object.keys(past.objects).forEach((objId) => {
                const pastObj = past.objects[objId];
                // @ts-ignore: hack to mark it as a "past object"
                if (pastObj.__pastObj) {
                    // Copy over it right away, it's old. Don't do anything else
                    resultingObjects[objId] = pastObj;
                    return;
                }
                // If an object exists in both timelines
                const presentObj = present.objects[objId];
                if (presentObj) {
                    if (
                    // Compare the objects, only look into merging them if they look identical
                    isEqual(Object.assign({}, pastObj, { resolved: null }), Object.assign({}, presentObj, { resolved: null }))) {
                        // This assumes that all past instances stop at a certain time at the very latest,
                        // and that all new instances start at that time at the very earliest.
                        // Iterate over all instances of those objects.
                        const allInstances = {};
                        pastObj.resolved.instances.forEach(pastInstance => {
                            allInstances[pastInstance.end + ''] = pastInstance;
                        });
                        presentObj.resolved.instances.forEach(presentInstance => {
                            if (allInstances[presentInstance.start + '']) {
                                // The instances are next to each other, merge them into one:
                                allInstances[presentInstance.start + ''].end = presentInstance.end;
                            }
                            else {
                                allInstances[presentInstance.start + ''] = presentInstance;
                            }
                        });
                        presentObj.resolved.instances = [];
                        Object.keys(allInstances).forEach(key => {
                            const instance = allInstances[key];
                            presentObj.resolved.instances.push(instance);
                        });
                        // Copy over the new object
                        resultingObjects[objId] = presentObj;
                        return; // don't copy over old object
                    }
                    else {
                        // The objects doesn't look identical
                        // Copy over the new object
                        resultingObjects[objId] = presentObj;
                    }
                }
                else {
                    // The old object doesn't exist in the new timeline
                }
                // @ts-ignore: hack to mark it as a "past object"
                pastObj.__pastObj = true;
                // Copy over the old object
                resultingObjects[this._mergeIterator + '__' + objId] = pastObj;
            });
            // Iterate over the next objects
            Object.keys(present.objects).forEach((objId) => {
                const presentObj = present.objects[objId];
                if (!past.objects[objId]) { // (if it did existed in the past, it has already been handled)
                    // Just copy over the new object
                    resultingObjects[objId] = presentObj;
                }
            });
        }
        else {
            // No new timeline, objects and instances are only added
            Object.keys(past.objects).forEach((objId) => {
                const pastObj = past.objects[objId];
                resultingObjects[objId] = pastObj;
            });
            Object.keys(present.objects).forEach((objId) => {
                const presentObj = present.objects[objId];
                const existingObj = resultingObjects[objId];
                if (existingObj) {
                    // merge with old instances
                    const existingInstances = {};
                    existingObj.resolved.instances.forEach(instance => {
                        existingInstances[instance.start + '_' + instance.end] = true;
                    });
                    presentObj.resolved.instances.forEach(instance => {
                        // Only push instances that aren't already present:
                        if (!existingInstances[instance.start + '_' + instance.end]) {
                            existingObj.resolved.instances.push(instance);
                        }
                    });
                }
                else {
                    resultingObjects[objId] = presentObj;
                }
            });
        }
        const resultingLayers = {};
        Object.keys(resultingObjects).forEach(key => {
            const obj = resultingObjects[key];
            const layer = obj.layer + '';
            if (!resultingLayers[layer])
                resultingLayers[layer] = [];
            resultingLayers[layer].push(key);
        });
        return Object.assign({}, present, { objects: resultingObjects, layers: resultingLayers });
    }
    updateTimelineResolveWindow() {
        const { start, end } = this.getExpandedStartEndTime(1);
        this._timelineResolveStart = start;
        this._timelineResolveEnd = end;
        this._timelineResolveZoom = this._timelineZoom;
        if (this.latestUpdateTime) {
            // Calculate an optimal number of objects to create, so that the drawing still runs smoothly.
            const targetResolveTime = 50; // ms
            let ratio = targetResolveTime / this.latestUpdateTime;
            this._timelineResolveCountAdjust = Math.max(0.1, Math.min(10, (1 + (this._timelineResolveCountAdjust * ratio)) / 2));
        }
    }
    getExpandedStartEndTime(multiplier = 1) {
        let start = this._viewStartTime;
        let end = this.viewEndTime;
        let duration = end - start;
        let expand = duration * (this._timelineResolveExpand - 1) * multiplier;
        start -= expand * 0.33;
        end += expand * 0.66; // expand more into the future
        start = Math.max(0, start);
        end = Math.max(0, end);
        const zoomDiff = Math.max(this._timelineResolveZoom, this._timelineZoom) /
            Math.min(this._timelineResolveZoom, this._timelineZoom);
        return { start, end, zoomDiff };
    }
    checkAutomaticReresolve() {
        const { start, end, zoomDiff } = this.getExpandedStartEndTime(0.2);
        if (this._timelineResolveAuto && (start < this._timelineResolveStart ||
            end > this._timelineResolveEnd ||
            zoomDiff > 3)) {
            if (!this.reresolveTimeout) {
                this.reresolveTimeout = setTimeout(() => {
                    this.reresolveTimeout = null;
                    this.updateTimelineResolveWindow();
                    this._updateTimeline();
                }, Math.max(100, this.latestUpdateTime * 5));
            }
        }
    }
    // --------------------- Conversions between position & time -------------
    /**
     * Calculate the X coordinate of a time value.
     * @param {number} time The time to convert.
     * @returns {number} The X coordinate of the time.
     */
    timeToXCoord(time) {
        return this._viewDrawX + ((time - this._viewStartTime) * this.pixelsWidthPerUnitTime);
    }
    /**
     * Calculate the time of a X coordinate.
     * @param {number} time The X coordinate to convert.
     * @returns {number} The time of the X coordinate.
     */
    xCoordToTime(position) {
        return this._viewStartTime + ((position - this._viewDrawX) / this.pixelsWidthPerUnitTime);
    }
    /** Calculate the ratio of the time in current view (0 i beginning, 1 is end)  */
    timeToRatio(time) {
        return (time - this._viewStartTime) / this.viewRange;
    }
    /** Returns true if the position is within the current view  */
    istimeInView(time) {
        const ratio = this.timeToRatio(time);
        return ratio >= 0 && ratio < 1;
    }
    capXcoordToView(position) {
        return Math.max(this._viewDrawX, Math.min(this._viewDrawX + this._viewDrawWidth, position));
    }
    // -------------- Getters / Convenience functions ---------------------
    /** Zoom factor [pixels / time] */
    get pixelsWidthPerUnitTime() {
        return (this._timelineZoom / 100);
    }
    /** The range of the view [time] */
    get viewRange() {
        return this._viewDrawWidth / this.pixelsWidthPerUnitTime;
    }
    /** The end time of the view [time] */
    get viewEndTime() {
        return this._viewStartTime + this.viewRange;
    }
}
exports.TimelineVisualizer = TimelineVisualizer;

},{"events":3,"lodash.isequal":4,"superfly-timeline":6}],3:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],4:[function(require,module,exports){
(function (global){
/**
 * Lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright JS Foundation and other contributors <https://js.foundation/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used to compose bitmasks for value comparisons. */
var COMPARE_PARTIAL_FLAG = 1,
    COMPARE_UNORDERED_FLAG = 2;

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    asyncTag = '[object AsyncFunction]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    nullTag = '[object Null]',
    objectTag = '[object Object]',
    promiseTag = '[object Promise]',
    proxyTag = '[object Proxy]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    undefinedTag = '[object Undefined]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    dataViewTag = '[object DataView]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
typedArrayTags[errorTag] = typedArrayTags[funcTag] =
typedArrayTags[mapTag] = typedArrayTags[numberTag] =
typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
typedArrayTags[setTag] = typedArrayTags[stringTag] =
typedArrayTags[weakMapTag] = false;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Detect free variable `exports`. */
var freeExports = typeof exports == 'object' && exports && !exports.nodeType && exports;

/** Detect free variable `module`. */
var freeModule = freeExports && typeof module == 'object' && module && !module.nodeType && module;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = freeModule && freeModule.exports === freeExports;

/** Detect free variable `process` from Node.js. */
var freeProcess = moduleExports && freeGlobal.process;

/** Used to access faster Node.js helpers. */
var nodeUtil = (function() {
  try {
    return freeProcess && freeProcess.binding && freeProcess.binding('util');
  } catch (e) {}
}());

/* Node.js helper references. */
var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

/**
 * A specialized version of `_.filter` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {Array} Returns the new filtered array.
 */
function arrayFilter(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length,
      resIndex = 0,
      result = [];

  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result[resIndex++] = value;
    }
  }
  return result;
}

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} [array] The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check,
 *  else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array == null ? 0 : array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function(value) {
    return func(value);
  };
}

/**
 * Checks if a `cache` value for `key` exists.
 *
 * @private
 * @param {Object} cache The cache to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function cacheHas(cache, key) {
  return cache.has(key);
}

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key];
}

/**
 * Converts `map` to its key-value pairs.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the key-value pairs.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function(arg) {
    return func(transform(arg));
  };
}

/**
 * Converts `set` to an array of its values.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the values.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    funcProto = Function.prototype,
    objectProto = Object.prototype;

/** Used to detect overreaching core-js shims. */
var coreJsData = root['__core-js_shared__'];

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function() {
  var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
  return uid ? ('Symbol(src)_1.' + uid) : '';
}());

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined,
    Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice,
    symToStringTag = Symbol ? Symbol.toStringTag : undefined;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeGetSymbols = Object.getOwnPropertySymbols,
    nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined,
    nativeKeys = overArg(Object.keys, Object);

/* Built-in method references that are verified to be native. */
var DataView = getNative(root, 'DataView'),
    Map = getNative(root, 'Map'),
    Promise = getNative(root, 'Promise'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var dataViewCtorString = toSource(DataView),
    mapCtorString = toSource(Map),
    promiseCtorString = toSource(Promise),
    setCtorString = toSource(Set),
    weakMapCtorString = toSource(WeakMap);

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = nativeCreate ? nativeCreate(null) : {};
  this.size = 0;
}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key];
  this.size -= result ? 1 : 0;
  return result;
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate) {
    var result = data[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate ? (data[key] !== undefined) : hasOwnProperty.call(data, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
  return this;
}

// Add methods to `Hash`.
Hash.prototype.clear = hashClear;
Hash.prototype['delete'] = hashDelete;
Hash.prototype.get = hashGet;
Hash.prototype.has = hashHas;
Hash.prototype.set = hashSet;

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = [];
  this.size = 0;
}

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  return index < 0 ? undefined : data[index][1];
}

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return assocIndexOf(this.__data__, key) > -1;
}

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
      index = assocIndexOf(data, key);

  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}

// Add methods to `ListCache`.
ListCache.prototype.clear = listCacheClear;
ListCache.prototype['delete'] = listCacheDelete;
ListCache.prototype.get = listCacheGet;
ListCache.prototype.has = listCacheHas;
ListCache.prototype.set = listCacheSet;

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
      length = entries == null ? 0 : entries.length;

  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    'hash': new Hash,
    'map': new (Map || ListCache),
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = getMapData(this, key)['delete'](key);
  this.size -= result ? 1 : 0;
  return result;
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return getMapData(this, key).get(key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return getMapData(this, key).has(key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = getMapData(this, key),
      size = data.size;

  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}

// Add methods to `MapCache`.
MapCache.prototype.clear = mapCacheClear;
MapCache.prototype['delete'] = mapCacheDelete;
MapCache.prototype.get = mapCacheGet;
MapCache.prototype.has = mapCacheHas;
MapCache.prototype.set = mapCacheSet;

/**
 *
 * Creates an array cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values == null ? 0 : values.length;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.add(values[index]);
  }
}

/**
 * Adds `value` to the array cache.
 *
 * @private
 * @name add
 * @memberOf SetCache
 * @alias push
 * @param {*} value The value to cache.
 * @returns {Object} Returns the cache instance.
 */
function setCacheAdd(value) {
  this.__data__.set(value, HASH_UNDEFINED);
  return this;
}

/**
 * Checks if `value` is in the array cache.
 *
 * @private
 * @name has
 * @memberOf SetCache
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function setCacheHas(value) {
  return this.__data__.has(value);
}

// Add methods to `SetCache`.
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
SetCache.prototype.has = setCacheHas;

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = this.__data__ = new ListCache(entries);
  this.size = data.size;
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new ListCache;
  this.size = 0;
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      result = data['delete'](key);

  this.size = data.size;
  return result;
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache) {
    var pairs = data.__data__;
    if (!Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new MapCache(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}

// Add methods to `Stack`.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray(value),
      isArg = !isArr && isArguments(value),
      isBuff = !isArr && !isArg && isBuffer(value),
      isType = !isArr && !isArg && !isBuff && isTypedArray(value),
      skipIndexes = isArr || isArg || isBuff || isType,
      result = skipIndexes ? baseTimes(value.length, String) : [],
      length = result.length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (
           // Safari 9 has enumerable `arguments.length` in strict mode.
           key == 'length' ||
           // Node.js 0.10 has enumerable non-index properties on buffers.
           (isBuff && (key == 'offset' || key == 'parent')) ||
           // PhantomJS 2 has enumerable non-index properties on typed arrays.
           (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
           // Skip index properties.
           isIndex(key, length)
        ))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
 * `keysFunc` and `symbolsFunc` to get the enumerable property names and
 * symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @param {Function} symbolsFunc The function to get the symbols of `object`.
 * @returns {Array} Returns the array of property names and symbols.
 */
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray(object) ? result : arrayPush(result, symbolsFunc(object));
}

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag;
  }
  return (symToStringTag && symToStringTag in Object(value))
    ? getRawTag(value)
    : objectToString(value);
}

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike(value) && baseGetTag(value) == argsTag;
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {boolean} bitmask The bitmask flags.
 *  1 - Unordered comparison
 *  2 - Partial comparison
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObjectLike(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
}

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = objIsArr ? arrayTag : getTag(object),
      othTag = othIsArr ? arrayTag : getTag(other);

  objTag = objTag == argsTag ? objectTag : objTag;
  othTag = othTag == argsTag ? objectTag : othTag;

  var objIsObj = objTag == objectTag,
      othIsObj = othTag == objectTag,
      isSameTag = objTag == othTag;

  if (isSameTag && isBuffer(object)) {
    if (!isBuffer(other)) {
      return false;
    }
    objIsArr = true;
    objIsObj = false;
  }
  if (isSameTag && !objIsObj) {
    stack || (stack = new Stack);
    return (objIsArr || isTypedArray(object))
      ? equalArrays(object, other, bitmask, customizer, equalFunc, stack)
      : equalByTag(object, other, objTag, bitmask, customizer, equalFunc, stack);
  }
  if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      var objUnwrapped = objIsWrapped ? object.value() : object,
          othUnwrapped = othIsWrapped ? other.value() : other;

      stack || (stack = new Stack);
      return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return equalObjects(object, other, bitmask, customizer, equalFunc, stack);
}

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject(value) || isMasked(value)) {
    return false;
  }
  var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource(value));
}

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
}

/**
 * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  if (!isPrototype(object)) {
    return nativeKeys(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != 'constructor') {
      result.push(key);
    }
  }
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var index = -1,
      result = true,
      seen = (bitmask & COMPARE_UNORDERED_FLAG) ? new SetCache : undefined;

  stack.set(array, other);
  stack.set(other, array);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (seen) {
      if (!arraySome(other, function(othValue, othIndex) {
            if (!cacheHas(seen, othIndex) &&
                (arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
        result = false;
        break;
      }
    } else if (!(
          arrValue === othValue ||
            equalFunc(arrValue, othValue, bitmask, customizer, stack)
        )) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  stack['delete'](other);
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
  switch (tag) {
    case dataViewTag:
      if ((object.byteLength != other.byteLength) ||
          (object.byteOffset != other.byteOffset)) {
        return false;
      }
      object = object.buffer;
      other = other.buffer;

    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
    case numberTag:
      // Coerce booleans to `1` or `0` and dates to milliseconds.
      // Invalid dates are coerced to `NaN`.
      return eq(+object, +other);

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings, primitives and objects,
      // as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
      // for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
      convert || (convert = setToArray);

      if (object.size != other.size && !isPartial) {
        return false;
      }
      // Assume cyclic values are equal.
      var stacked = stack.get(object);
      if (stacked) {
        return stacked == other;
      }
      bitmask |= COMPARE_UNORDERED_FLAG;

      // Recursively compare objects (susceptible to call stack limits).
      stack.set(object, other);
      var result = equalArrays(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
      stack['delete'](object);
      return result;

    case symbolTag:
      if (symbolValueOf) {
        return symbolValueOf.call(object) == symbolValueOf.call(other);
      }
  }
  return false;
}

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
 * @param {Function} customizer The function to customize comparisons.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Object} stack Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
  var isPartial = bitmask & COMPARE_PARTIAL_FLAG,
      objProps = getAllKeys(object),
      objLength = objProps.length,
      othProps = getAllKeys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : hasOwnProperty.call(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked && stack.get(other)) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);
  stack.set(other, object);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  stack['delete'](other);
  return result;
}

/**
 * Creates an array of own enumerable property names and symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names and symbols.
 */
function getAllKeys(object) {
  return baseGetAllKeys(object, keys, getSymbols);
}

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = getValue(object, key);
  return baseIsNative(value) ? value : undefined;
}

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
      tag = value[symToStringTag];

  try {
    value[symToStringTag] = undefined;
    var unmasked = true;
  } catch (e) {}

  var result = nativeObjectToString.call(value);
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag;
    } else {
      delete value[symToStringTag];
    }
  }
  return result;
}

/**
 * Creates an array of the own enumerable symbols of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return arrayFilter(nativeGetSymbols(object), function(symbol) {
    return propertyIsEnumerable.call(object, symbol);
  });
};

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
var getTag = baseGetTag;

// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
if ((DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
    (Map && getTag(new Map) != mapTag) ||
    (Promise && getTag(Promise.resolve()) != promiseTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = baseGetTag(value),
        Ctor = result == objectTag ? value.constructor : undefined,
        ctorString = Ctor ? toSource(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case dataViewCtorString: return dataViewTag;
        case mapCtorString: return mapTag;
        case promiseCtorString: return promiseTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
    ? (value !== '__proto__')
    : (value === null);
}

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && (maskSrcKey in func);
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString.call(value);
}

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func);
    } catch (e) {}
    try {
      return (func + '');
    } catch (e) {}
  }
  return '';
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
  return isObjectLike(value) && hasOwnProperty.call(value, 'callee') &&
    !propertyIsEnumerable.call(value, 'callee');
};

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @since 4.3.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = nativeIsBuffer || stubFalse;

/**
 * Performs a deep comparison between two values to determine if they are
 * equivalent.
 *
 * **Note:** This method supports comparing arrays, array buffers, booleans,
 * date objects, error objects, maps, numbers, `Object` objects, regexes,
 * sets, strings, symbols, and typed arrays. `Object` objects are compared
 * by their own, not inherited, enumerable properties. Functions and DOM
 * nodes are compared by strict equality, i.e. `===`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.isEqual(object, other);
 * // => true
 *
 * object === other;
 * // => false
 */
function isEqual(value, other) {
  return baseIsEqual(value, other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject(value)) {
    return false;
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = baseGetTag(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
}

/**
 * This method returns a new empty array.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {Array} Returns the new empty array.
 * @example
 *
 * var arrays = _.times(2, _.stubArray);
 *
 * console.log(arrays);
 * // => [[], []]
 *
 * console.log(arrays[0] === arrays[1]);
 * // => false
 */
function stubArray() {
  return [];
}

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false;
}

module.exports = isEqual;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var EventType;
(function (EventType) {
    EventType[EventType["START"] = 0] = "START";
    EventType[EventType["END"] = 1] = "END";
    EventType[EventType["KEYFRAME"] = 2] = "KEYFRAME";
})(EventType = exports.EventType || (exports.EventType = {}));

},{}],6:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
tslib_1.__exportStar(require("./api/enums"), exports);
var resolver_1 = require("./resolver/resolver");
exports.Resolver = resolver_1.Resolver;
var validate_1 = require("./resolver/validate");
exports.validateTimeline = validate_1.validateTimeline;
exports.validateObject = validate_1.validateObject;
exports.validateKeyframe = validate_1.validateKeyframe;

},{"./api/enums":5,"./resolver/resolver":10,"./resolver/validate":12,"tslib":13}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
/**
 * Somewhat like _.extend, but with strong types & mandated additional properties
 * @param original Object to be extended
 * @param extendObj properties to add
 */
function extendMandadory(original, extendObj) {
    return _.extend(original, extendObj);
}
exports.extendMandadory = extendMandadory;
function isConstant(str) {
    return !!(isNumeric(str) ||
        (_.isString(str) &&
            (str.match(/^true$/) ||
                str.match(/^false$/))));
}
exports.isConstant = isConstant;
function isNumeric(str) {
    if (str === null)
        return false;
    if (_.isNumber(str))
        return true;
    if (_.isString(str))
        return !!(str.match(/^[0-9\.\-]+$/) && !_.isNaN(parseFloat(str)));
    return false;
}
exports.isNumeric = isNumeric;
function sortEvents(events) {
    return events.sort(function (a, b) {
        if (a.time > b.time)
            return 1;
        if (a.time < b.time)
            return -1;
        var aId = a.data && (a.data.id || (a.data.instance && a.data.instance.id));
        var bId = b.data && (b.data.id || (b.data.instance && b.data.instance.id));
        if (aId && bId && aId === bId) {
            // If the event refer to the same ID, let the ending event be first:
            if (a.value && !b.value)
                return -1;
            if (!a.value && b.value)
                return 1;
        }
        if (a.value && !b.value)
            return 1;
        if (!a.value && b.value)
            return -1;
        return 0;
    });
}
exports.sortEvents = sortEvents;
/**
 * Clean up instances, join overlapping etc..
 * @param instances
 */
function cleanInstances(instances, allowMerge, allowZeroGaps) {
    // if (!allowMerge) throw new Error(`TODO: cleanInstances: allowMerge is temorarily removed`)
    if (allowZeroGaps === void 0) { allowZeroGaps = false; }
    var events = [];
    // let i: number = 1
    _.each(instances, function (instance) {
        // const id = 'i' + (i++)
        events.push({
            time: instance.start,
            value: true,
            data: { instance: instance },
            references: instance.references
        });
        if (instance.end !== null) {
            events.push({
                time: instance.end,
                value: false,
                data: { instance: instance },
                references: instance.references
            });
        }
    });
    return convertEventsToInstances(events, allowMerge, allowZeroGaps);
}
exports.cleanInstances = cleanInstances;
function convertEventsToInstances(events, allowMerge, allowZeroGaps) {
    if (allowZeroGaps === void 0) { allowZeroGaps = false; }
    sortEvents(events);
    var activeInstances = {};
    var activeInstanceId = null;
    var previousActive = false;
    var returnInstances = [];
    _.each(events, function (event) {
        var eventId = event.data.id || event.data.instance.id;
        var lastInstance = _.last(returnInstances);
        if (event.value) {
            activeInstances[eventId] = event;
        }
        else {
            delete activeInstances[eventId];
        }
        if (_.keys(activeInstances).length) {
            // There is an active instance
            previousActive = true;
            if (!allowMerge &&
                event.value &&
                lastInstance &&
                lastInstance.end === null &&
                activeInstanceId !== null &&
                activeInstanceId !== eventId) {
                // Start a new instance:
                lastInstance.end = event.time;
                returnInstances.push({
                    id: getId(),
                    start: event.time,
                    end: null,
                    references: event.references
                });
                activeInstanceId = eventId;
            }
            else if (!allowMerge &&
                !event.value &&
                lastInstance &&
                activeInstanceId === eventId) {
                // The active instance stopped playing, but another is still playing
                var latestInstance = _.reduce(activeInstances, function (memo, event, id) {
                    if (memo === null ||
                        memo.event.time < event.time) {
                        return {
                            event: event,
                            id: id
                        };
                    }
                    return memo;
                }, null);
                if (latestInstance) {
                    // Restart that instance now:
                    lastInstance.end = event.time;
                    returnInstances.push({
                        id: eventId + '_' + getId(),
                        start: event.time,
                        end: null,
                        references: latestInstance.event.references
                    });
                    activeInstanceId = latestInstance.id;
                }
            }
            else if (allowMerge &&
                !allowZeroGaps &&
                lastInstance &&
                lastInstance.end === event.time) {
                // The previously running ended just now
                // resume previous instance:
                lastInstance.end = null;
                lastInstance.references = joinReferences(lastInstance.references, event.references);
                addCapsToResuming(lastInstance, event.data.instance.caps);
            }
            else if (!lastInstance ||
                lastInstance.end !== null) {
                // There is no previously running instance
                // Start a new instance:
                returnInstances.push({
                    id: eventId,
                    start: event.time,
                    end: null,
                    references: event.references,
                    caps: event.data.instance.caps
                });
                activeInstanceId = eventId;
            }
            else {
                // There is already a running instance
                lastInstance.references = joinReferences(lastInstance.references, event.references);
                addCapsToResuming(lastInstance, event.data.instance.caps);
            }
            if (lastInstance && lastInstance.caps && !lastInstance.caps.length)
                delete lastInstance.caps;
        }
        else {
            // No instances are active
            if (lastInstance &&
                previousActive) {
                lastInstance.end = event.time;
            }
            previousActive = false;
        }
    });
    return returnInstances;
}
exports.convertEventsToInstances = convertEventsToInstances;
function invertInstances(instances) {
    if (instances.length) {
        instances = cleanInstances(instances, true, true);
        var invertedInstances_1 = [];
        if (instances[0].start !== 0) {
            invertedInstances_1.push({
                id: getId(),
                isFirst: true,
                start: 0,
                end: null,
                references: joinReferences(instances[0].references, instances[0].id)
            });
        }
        _.each(instances, function (instance) {
            var last = _.last(invertedInstances_1);
            if (last) {
                last.end = instance.start;
            }
            if (instance.end !== null) {
                invertedInstances_1.push({
                    id: getId(),
                    start: instance.end,
                    end: null,
                    references: joinReferences(instance.references, instance.id),
                    caps: instance.caps
                });
            }
        });
        return invertedInstances_1;
    }
    else {
        return [{
                id: getId(),
                isFirst: true,
                start: 0,
                end: null,
                references: []
            }];
    }
}
exports.invertInstances = invertInstances;
/**
 * Perform an action on 2 arrays. Behaves somewhat like the ".*"-operator in Matlab
 * @param array0
 * @param array1
 * @param operate
 */
function operateOnArrays(array0, array1, operate) {
    if (array0 === null ||
        array1 === null)
        return null;
    if (isReference(array0) &&
        isReference(array1)) {
        return operate(array0, array1);
    }
    var result = [];
    var minLength = Math.min(_.isArray(array0) ? array0.length : Infinity, _.isArray(array1) ? array1.length : Infinity);
    for (var i_1 = 0; i_1 < minLength; i_1++) {
        var a = (_.isArray(array0) ?
            array0[i_1] :
            { id: '', start: array0.value, end: array0.value, references: array0.references });
        var b = (_.isArray(array1) ?
            array1[i_1] :
            { id: '', start: array1.value, end: array1.value, references: array1.references });
        var start = (a.isFirst ?
            { value: a.start, references: a.references } :
            b.isFirst ?
                { value: b.start, references: b.references } :
                operate({ value: a.start, references: joinReferences(a.id, a.references) }, { value: b.start, references: joinReferences(b.id, b.references) }));
        var end = (a.isFirst ?
            (a.end !== null ? { value: a.end, references: a.references } : null) :
            b.isFirst ?
                (b.end !== null ? { value: b.end, references: b.references } : null) :
                operate(a.end !== null ? { value: a.end, references: joinReferences(a.id, a.references) } : null, b.end !== null ? { value: b.end, references: joinReferences(b.id, b.references) } : null));
        if (start !== null) {
            result.push({
                id: getId(),
                start: start.value,
                end: end === null ? null : end.value,
                references: joinReferences(start.references, end !== null ? end.references : []),
                caps: joinCaps(a.caps, b.caps)
            });
        }
    }
    return cleanInstances(result, false);
}
exports.operateOnArrays = operateOnArrays;
/**
 * Like operateOnArrays, but will multiply the number of elements in array0, with the number of elements in array1
 * @param array0
 * @param array1
 * @param operate
 */
/*export function operateOnArraysMulti (
    array0: Array<TimelineObjectInstance> | Reference | null,
    array1: Array<TimelineObjectInstance> | Reference | null,
    operate: (a: Reference | null, b: Reference | null) => Reference | null
) {
    if (array0 === null) return null

    if (_.isArray(array1)) {
        let resultArray: Array<TimelineObjectInstance> = []
        _.each(array1, (array1Val) => {
            const result = operateOnArrays(array0, { value: array1Val.start, references: array1Val.references } , operate)
            if (_.isArray(result)) {
                resultArray = resultArray.concat(result)
            } else if (result !== null) {
                resultArray.push({
                    id: getId(),
                    start: result.value,
                    end: (
                        array1Val.end !== null ?
                        result.value + (array1Val.end - array1Val.start) :
                        null
                    ),
                    references: result.references
                })
            }
        })
        return resultArray
    } else {
        return operateOnArrays(array0, array1, operate)
    }
}
*/
function applyRepeatingInstances(instances, repeatTime0, options) {
    if (repeatTime0 === null ||
        !repeatTime0.value)
        return instances;
    var repeatTime = repeatTime0.value;
    if (isReference(instances)) {
        instances = [{
                id: '',
                start: instances.value,
                end: null,
                references: instances.references
            }];
    }
    var repeatedInstances = [];
    _.each(instances, function (instance) {
        var startTime = Math.max(options.time - (options.time - instance.start) % repeatTime, instance.start);
        var endTime = (instance.end === null ?
            null :
            instance.end + (startTime - instance.start));
        var cap = (instance.caps ?
            _.find(instance.caps, function (cap) { return instance.references.indexOf(cap.id) !== -1; })
            : null) || null;
        var limit = options.limitCount || 2;
        for (var i_2 = 0; i_2 < limit; i_2++) {
            if (options.limitTime &&
                startTime >= options.limitTime)
                break;
            var cappedStartTime = (cap ?
                Math.max(cap.start, startTime) :
                startTime);
            var cappedEndTime = (cap && cap.end !== null && endTime !== null ?
                Math.min(cap.end, endTime) :
                endTime);
            if ((cappedEndTime || Infinity) > cappedStartTime) {
                repeatedInstances.push({
                    id: getId(),
                    start: cappedStartTime,
                    end: cappedEndTime,
                    references: joinReferences(instance.id, instance.references, repeatTime0.references)
                });
            }
            startTime += repeatTime;
            if (endTime !== null)
                endTime += repeatTime;
        }
    });
    return cleanInstances(repeatedInstances, false);
}
exports.applyRepeatingInstances = applyRepeatingInstances;
function capInstances(instances, parentInstances) {
    if (isReference(parentInstances) ||
        parentInstances === null)
        return instances;
    var returnInstances = [];
    _.each(instances, function (instance) {
        var parent = null;
        _.each(parentInstances, function (p) {
            if (instance.start >= p.start &&
                instance.start < (p.end || Infinity)) {
                if (parent === null ||
                    (p.end || Infinity) > (parent.end || Infinity)) {
                    parent = p;
                }
            }
        });
        if (!parent) {
            _.each(parentInstances, function (p) {
                if ((instance.end || Infinity) > p.start &&
                    (instance.end || Infinity) <= (p.end || Infinity)) {
                    if (parent === null ||
                        (p.end || Infinity) < (parent.end || Infinity)) {
                        parent = p;
                    }
                }
            });
        }
        if (parent) {
            var parent2 = parent; // cast type
            var i2 = _.clone(instance);
            if (parent2.end !== null &&
                (i2.end || Infinity) > parent2.end) {
                i2.end = parent2.end;
            }
            if ((i2.start || Infinity) < parent2.start) {
                i2.start = parent2.start;
            }
            returnInstances.push(i2);
        }
    });
    return returnInstances;
}
exports.capInstances = capInstances;
function isReference(ref) {
    return (_.isObject(ref) &&
        !_.isArray(ref) &&
        ref.value !== undefined &&
        _.isArray(ref.references) &&
        ref !== null);
}
exports.isReference = isReference;
function joinReferences() {
    var references = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        references[_i] = arguments[_i];
    }
    return _.compact(_.uniq(_.reduce(references, function (memo, ref) {
        if (_.isString(ref))
            return memo.concat([ref]);
        else
            return memo.concat(ref);
    }, []))).sort(function (a, b) {
        if (a > b)
            return 1;
        if (a < b)
            return -1;
        return 0;
    });
}
exports.joinReferences = joinReferences;
function addCapsToResuming(instance) {
    var caps = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        caps[_i - 1] = arguments[_i];
    }
    var capsToAdd = [];
    _.each(joinCaps.apply(void 0, caps), function (cap) {
        if (cap.end &&
            instance.end &&
            cap.end > instance.end) {
            capsToAdd.push({
                id: cap.id,
                start: 0,
                end: cap.end
            });
        }
    });
    instance.caps = joinCaps(instance.caps, capsToAdd);
}
exports.addCapsToResuming = addCapsToResuming;
function joinCaps() {
    var caps = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        caps[_i] = arguments[_i];
    }
    return (_.uniq(_.compact(_.reduce(caps, function (memo, cap) {
        if (cap !== undefined) {
            return (memo || []).concat(cap);
        }
        else
            return memo;
    }, [])), false, function (cap) {
        return cap.id;
    }));
}
exports.joinCaps = joinCaps;
var i = 0;
/**
 * Returns a unique id
 */
function getId() {
    return '@' + (i++).toString(36);
}
exports.getId = getId;
function resetId() {
    i = 0;
}
exports.resetId = resetId;

},{"underscore":14}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
function addObjectToResolvedTimeline(resolvedTimeline, obj) {
    resolvedTimeline.objects[obj.id] = obj;
    if (obj.classes) {
        _.each(obj.classes, function (className) {
            if (className) {
                if (!resolvedTimeline.classes[className])
                    resolvedTimeline.classes[className] = [];
                resolvedTimeline.classes[className].push(obj.id);
            }
        });
    }
    if (obj.layer) {
        if (!resolvedTimeline.layers[obj.layer])
            resolvedTimeline.layers[obj.layer] = [];
        resolvedTimeline.layers[obj.layer].push(obj.id);
    }
}
exports.addObjectToResolvedTimeline = addObjectToResolvedTimeline;

},{"underscore":14}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
exports.OPERATORS = ['&', '|', '+', '-', '*', '/', '%', '!'];
function interpretExpression(expr) {
    if (_.isString(expr)) {
        var operatorList = exports.OPERATORS;
        var regexpOperators = _.map(operatorList, function (o) { return '\\' + o; }).join('');
        expr = expr.replace(new RegExp('([' + regexpOperators + '\\(\\)])', 'g'), ' $1 '); // Make sure there's a space between every operator & operand
        var words = _.compact(expr.split(' '));
        if (words.length === 0)
            return null; // empty expression
        // Fix special case: a + - b
        for (var i = words.length - 2; i >= 1; i--) {
            if ((words[i] === '-' || words[i] === '+') && wordIsOperator(operatorList, words[i - 1])) {
                words[i] = words[i] + words[i + 1];
                words.splice(i + 1, 1);
            }
        }
        var innerExpression = wrapInnerExpressions(words);
        if (innerExpression.rest.length)
            throw new Error('interpretExpression: syntax error: parentheses don\'t add up in "' + expr + '".');
        if (innerExpression.inner.length % 2 !== 1)
            throw new Error('interpretExpression: operands & operators don\'t add up: "' + innerExpression.inner.join(' ') + '".');
        var expression = words2Expression(operatorList, innerExpression.inner);
        validateExpression(operatorList, expression);
        return expression;
    }
    else if (_.isNumber(expr)) {
        return expr;
        // return {
        // 	l: expr,
        // 	o: '+',
        // 	r: 0
        // }
    }
    else {
        return expr;
    }
}
exports.interpretExpression = interpretExpression;
function wordIsOperator(operatorList, word) {
    if (operatorList.indexOf(word) !== -1)
        return true;
    return false;
}
// Turns ['a', '(', 'b', 'c', ')'] into ['a', ['b', 'c']]
// or ['a', '&', '!', 'b'] into ['a', '&', ['', '!', 'b']]
function wrapInnerExpressions(words) {
    for (var i = 0; i < words.length; i++) {
        if (words[i] === '(') {
            var tmp = wrapInnerExpressions(words.slice(i + 1));
            // insert inner expression and remove tha
            words[i] = tmp.inner;
            words.splice.apply(words, [i + 1, 99999].concat(tmp.rest));
        }
        else if (words[i] === ')') {
            return {
                inner: words.slice(0, i),
                rest: words.slice(i + 1)
            };
        }
        else if (words[i] === '!') {
            var tmp = wrapInnerExpressions(words.slice(i + 1));
            // insert inner expression after the '!'
            words[i] = ['', '!'].concat(tmp.inner);
            words.splice.apply(words, [i + 1, 99999].concat(tmp.rest));
        }
    }
    return {
        inner: words,
        rest: []
    };
}
exports.wrapInnerExpressions = wrapInnerExpressions;
function words2Expression(operatorList, words) {
    if (!words || !words.length)
        throw new Error('words2Expression: syntax error: unbalanced expression');
    while (words.length === 1 && _.isArray(words[0]))
        words = words[0];
    if (words.length === 1)
        return words[0];
    // Find the operator with the highest priority:
    var operatorI = -1;
    _.each(operatorList, function (operator) {
        if (operatorI === -1) {
            operatorI = words.lastIndexOf(operator);
        }
    });
    if (operatorI !== -1) {
        var l = words.slice(0, operatorI);
        var r = words.slice(operatorI + 1);
        var expr = {
            l: words2Expression(operatorList, l),
            o: words[operatorI],
            r: words2Expression(operatorList, r)
        };
        return expr;
    }
    else
        throw new Error('words2Expression: syntax error: operator not found: "' + (words.join(' ')) + '"');
}
function validateExpression(operatorList, expr0, breadcrumbs) {
    if (!breadcrumbs)
        breadcrumbs = 'ROOT';
    if (_.isObject(expr0) && !_.isArray(expr0)) {
        var expr = expr0;
        if (!_.has(expr, 'l'))
            throw new Error("validateExpression: " + breadcrumbs + ".l missing in " + JSON.stringify(expr));
        if (!_.has(expr, 'o'))
            throw new Error("validateExpression: " + breadcrumbs + ".o missing in " + JSON.stringify(expr));
        if (!_.has(expr, 'r'))
            throw new Error("validateExpression: " + breadcrumbs + ".r missing in " + JSON.stringify(expr));
        if (!_.isString(expr.o))
            throw new Error("validateExpression: " + breadcrumbs + ".o not a string");
        if (!wordIsOperator(operatorList, expr.o))
            throw new Error(breadcrumbs + '.o not valid: "' + expr.o + '"');
        validateExpression(operatorList, expr.l, breadcrumbs + '.l');
        validateExpression(operatorList, expr.r, breadcrumbs + '.r');
    }
    else if (!_.isNull(expr0) && !_.isString(expr0) && !_.isNumber(expr0)) {
        throw new Error("validateExpression: " + breadcrumbs + " is of invalid type");
    }
}

},{"underscore":14}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
var lib_1 = require("../lib");
var validate_1 = require("./validate");
var expression_1 = require("./expression");
var state_1 = require("./state");
var common_1 = require("./common");
var Resolver = /** @class */ (function () {
    function Resolver() {
    }
    /**
     * Go through all objects on the timeline and calculate all the timings.
     * Returns a ResolvedTimeline which can be piped into Resolver.getState()
     * @param timeline Array of timeline objects
     * @param options Resolve options
     */
    Resolver.resolveTimeline = function (timeline, options) {
        if (!_.isArray(timeline))
            throw new Error('resolveTimeline: parameter timeline missing');
        if (!options)
            throw new Error('resolveTimeline: parameter options missing');
        validate_1.validateTimeline(timeline, false);
        lib_1.resetId();
        var resolvedTimeline = {
            options: _.clone(options),
            objects: {},
            classes: {},
            layers: {},
            statistics: {
                unresolvedCount: 0,
                resolvedCount: 0,
                resolvedInstanceCount: 0,
                resolvedObjectCount: 0,
                resolvedGroupCount: 0,
                resolvedKeyframeCount: 0
            }
        };
        // Step 1: pre-populate resolvedTimeline with objects
        var addToResolvedTimeline = function (obj, levelDeep, parentId, isKeyframe) {
            if (resolvedTimeline.objects[obj.id])
                throw Error("All timelineObjects must be unique! (duplicate: \"" + obj.id + "\")");
            var o = lib_1.extendMandadory(_.clone(obj), {
                resolved: {
                    resolved: false,
                    resolving: false,
                    instances: [],
                    levelDeep: levelDeep
                }
            });
            if (parentId)
                o.resolved.parentId = parentId;
            if (isKeyframe)
                o.resolved.isKeyframe = true;
            common_1.addObjectToResolvedTimeline(resolvedTimeline, o);
            // Add children:
            if (obj.isGroup && obj.children) {
                _.each(obj.children, function (child) {
                    addToResolvedTimeline(child, levelDeep + 1, obj.id);
                });
            }
            // Add keyframes:
            if (obj.keyframes) {
                _.each(obj.keyframes, function (keyframe) {
                    var kf2 = lib_1.extendMandadory(_.clone(keyframe), {
                        layer: ''
                    });
                    addToResolvedTimeline(kf2, levelDeep + 1, obj.id, true);
                });
            }
        };
        _.each(timeline, function (obj) {
            addToResolvedTimeline(obj, 0);
        });
        // Step 2: go though and resolve the objects
        _.each(resolvedTimeline.objects, function (obj) {
            resolveTimelineObj(resolvedTimeline, obj);
        });
        return resolvedTimeline;
    };
    /** Calculate the state for all points in time.  */
    Resolver.resolveAllStates = function (resolvedTimeline) {
        return state_1.resolveStates(resolvedTimeline);
    };
    /**
     * Calculate the state at a given point in time.
     * Using a ResolvedTimeline calculated by Resolver.resolveTimeline() or
     * a ResolvedStates calculated by Resolver.resolveAllStates()
     * @param resolved ResolvedTimeline calculated by Resolver.resolveTimeline.
     * @param time The point in time where to calculate the state
     * @param eventLimit (Optional) Limits the number of returned upcoming events.
     */
    Resolver.getState = function (resolved, time, eventLimit) {
        return state_1.getState(resolved, time, eventLimit);
    };
    return Resolver;
}());
exports.Resolver = Resolver;
function resolveTimelineObj(resolvedTimeline, obj) {
    if (obj.resolved.resolved)
        return;
    if (obj.resolved.resolving)
        throw new Error("Circular dependency when trying to resolve \"" + obj.id + "\"");
    obj.resolved.resolving = true;
    var instances = [];
    var repeatingExpr = (obj.enable.repeating !== undefined ?
        expression_1.interpretExpression(obj.enable.repeating) :
        null);
    var lookedupRepeating = lookupExpression(resolvedTimeline, obj, repeatingExpr, 'duration');
    if (_.isArray(lookedupRepeating)) {
        throw new Error("lookupExpression should never return an array for .duration lookup"); // perhaps tmp? maybe revisit this at some point
    }
    var start = (obj.enable.while !== undefined ?
        obj.enable.while :
        obj.enable.start !== undefined ?
            obj.enable.start :
            '');
    if (obj.enable.while === '1') {
        start = 'true';
    }
    else if (obj.enable.while === '0') {
        start = 'false';
    }
    var startExpr = expression_1.interpretExpression(start);
    var parentInstances = null;
    var hasParent = false;
    var referToParent = false;
    if (obj.resolved.parentId) {
        hasParent = true;
        parentInstances = lookupExpression(resolvedTimeline, obj, expression_1.interpretExpression("#" + obj.resolved.parentId), 'start');
        if (lib_1.isConstant(startExpr)) {
            // Only use parent if the expression resolves to a number (ie doesn't contain any references)
            referToParent = true;
        }
    }
    var lookedupStarts = lookupExpression(resolvedTimeline, obj, startExpr, 'start');
    var applyParentInstances = function (value) {
        var operate = function (a, b) {
            if (a === null || b === null)
                return null;
            return {
                value: a.value + b.value,
                references: lib_1.joinReferences(a.references, b.references)
            };
        };
        return lib_1.operateOnArrays(parentInstances, value, operate);
    };
    if (referToParent) {
        lookedupStarts = applyParentInstances(lookedupStarts);
    }
    if (obj.enable.while) {
        if (_.isArray(lookedupStarts)) {
            instances = lookedupStarts;
        }
        else if (lookedupStarts !== null) {
            instances = [{
                    id: lib_1.getId(),
                    start: lookedupStarts.value,
                    end: null,
                    references: lookedupStarts.references
                }];
        }
    }
    else {
        var events_1 = [];
        var iStart_1 = 0;
        var iEnd_1 = 0;
        if (_.isArray(lookedupStarts)) {
            _.each(lookedupStarts, function (instance) {
                events_1.push({
                    time: instance.start,
                    value: true,
                    data: { instance: instance, id: obj.id + '_' + iStart_1++ },
                    references: instance.references
                });
            });
        }
        else if (lookedupStarts !== null) {
            events_1.push({
                time: lookedupStarts.value,
                value: true,
                data: { instance: { id: lib_1.getId(), start: lookedupStarts.value, end: null, references: lookedupStarts.references }, id: obj.id + '_' + iStart_1++ },
                references: lookedupStarts.references
            });
        }
        if (obj.enable.end !== undefined) {
            var endExpr = expression_1.interpretExpression(obj.enable.end);
            // lookedupEnds will contain an inverted list of instances. Therefore .start means an end
            var lookedupEnds = (endExpr ?
                lookupExpression(resolvedTimeline, obj, endExpr, 'end') :
                null);
            if (referToParent && lib_1.isConstant(endExpr)) {
                lookedupEnds = applyParentInstances(lookedupEnds);
            }
            if (_.isArray(lookedupEnds)) {
                _.each(lookedupEnds, function (instance) {
                    events_1.push({
                        time: instance.start,
                        value: false,
                        data: { instance: instance, id: obj.id + '_' + iEnd_1++ },
                        references: instance.references
                    });
                });
            }
            else if (lookedupEnds !== null) {
                events_1.push({
                    time: lookedupEnds.value,
                    value: false,
                    data: { instance: { id: lib_1.getId(), start: lookedupEnds.value, end: null, references: lookedupEnds.references }, id: obj.id + '_' + iEnd_1++ },
                    references: lookedupEnds.references
                });
            }
        }
        else if (obj.enable.duration !== undefined) {
            var durationExpr = expression_1.interpretExpression(obj.enable.duration);
            var lookedupDuration = lookupExpression(resolvedTimeline, obj, durationExpr, 'duration');
            if (_.isArray(lookedupDuration) && lookedupDuration.length === 1) {
                lookedupDuration = {
                    value: lookedupDuration[0].start,
                    references: lookedupDuration[0].references
                };
            }
            if (_.isArray(lookedupDuration)) {
                throw new Error("lookupExpression should never return an array for .duration lookup"); // perhaps tmp? maybe revisit this at some point
            }
            else if (lookedupDuration !== null) {
                if (lookedupRepeating !== null &&
                    lookedupDuration.value > lookedupRepeating.value)
                    lookedupDuration.value = lookedupRepeating.value;
                var tmpLookedupDuration_1 = lookedupDuration; // cast type
                _.each(events_1, function (e) {
                    if (e.value) {
                        var time = e.time + tmpLookedupDuration_1.value;
                        var references = lib_1.joinReferences(e.references, tmpLookedupDuration_1.references);
                        events_1.push({
                            time: time,
                            value: false,
                            data: { id: e.data.id, instance: { id: e.data.instance.id, start: time, end: null, references: references } },
                            references: references
                        });
                    }
                });
            }
        }
        instances = lib_1.convertEventsToInstances(events_1, false);
    }
    if (hasParent) {
        // figure out what parent-instance the instances are tied to, and cap them
        var cappedInstances_1 = [];
        _.each(instances, function (instance) {
            if (_.isArray(parentInstances)) {
                var parentInstance = _.find(parentInstances, function (parentInstance) {
                    return instance.references.indexOf(parentInstance.id) !== -1;
                });
                var cappedInstance = (parentInstance ?
                    lib_1.capInstances([instance], [parentInstance])[0] :
                    instance);
                if (cappedInstance) {
                    if (parentInstance) {
                        if (!cappedInstance.caps)
                            cappedInstance.caps = [];
                        cappedInstance.caps.push({
                            id: parentInstance.id,
                            start: parentInstance.start,
                            end: parentInstance.end
                        });
                    }
                    cappedInstances_1.push(cappedInstance);
                }
            }
        });
        instances = cappedInstances_1;
    }
    instances = lib_1.applyRepeatingInstances(instances, lookedupRepeating, resolvedTimeline.options);
    // filter out zero-length instances:
    instances = _.filter(instances, function (instance) {
        return ((instance.end || Infinity) > instance.start);
    });
    obj.resolved.resolved = true;
    obj.resolved.resolving = false;
    obj.resolved.instances = instances;
    if (instances.length) {
        resolvedTimeline.statistics.resolvedInstanceCount += instances.length;
        resolvedTimeline.statistics.resolvedCount += 1;
        if (obj.isGroup) {
            resolvedTimeline.statistics.resolvedGroupCount += 1;
        }
        if (obj.resolved.isKeyframe) {
            resolvedTimeline.statistics.resolvedKeyframeCount += 1;
        }
        else {
            resolvedTimeline.statistics.resolvedObjectCount += 1;
        }
    }
    else {
        resolvedTimeline.statistics.unresolvedCount += 1;
    }
}
exports.resolveTimelineObj = resolveTimelineObj;
function lookupExpression(resolvedTimeline, obj, expr, context) {
    if (expr === null)
        return null;
    if (_.isString(expr) &&
        lib_1.isNumeric(expr)) {
        return {
            value: parseFloat(expr),
            references: []
        };
    }
    else if (_.isNumber(expr)) {
        return {
            value: expr,
            references: []
        };
    }
    else if (_.isString(expr)) {
        expr = expr.trim();
        if (lib_1.isConstant(expr)) {
            if (expr.match(/^true$/i)) {
                return {
                    value: 0,
                    references: []
                };
            }
            else if (expr.match(/^false$/i)) {
                return [];
            }
        }
        // Look up string
        var invert = false;
        var ignoreFirstIfZero = false;
        var referencedObjs_1 = [];
        var ref = context;
        var rest = '';
        // Match id, example: "#objectId.start"
        var m = expr.match(/^\W*#([^.]+)(.*)/);
        if (m) {
            var id = m[1];
            rest = m[2];
            var obj_1 = resolvedTimeline.objects[id];
            if (obj_1) {
                referencedObjs_1.push(obj_1);
            }
        }
        else {
            // Match class, example: ".className.start"
            var m_1 = expr.match(/^\W*\.([^.]+)(.*)/);
            if (m_1) {
                var className = m_1[1];
                rest = m_1[2];
                var objIds = resolvedTimeline.classes[className] || [];
                _.each(objIds, function (objId) {
                    var obj = resolvedTimeline.objects[objId];
                    if (obj) {
                        referencedObjs_1.push(obj);
                    }
                });
            }
            else {
                // Match layer, example: "$layer"
                var m_2 = expr.match(/^\W*\$([^.]+)(.*)/);
                if (m_2) {
                    var layer = m_2[1];
                    rest = m_2[2];
                    var objIds = resolvedTimeline.layers[layer] || [];
                    _.each(objIds, function (objId) {
                        var obj = resolvedTimeline.objects[objId];
                        if (obj) {
                            referencedObjs_1.push(obj);
                        }
                    });
                }
            }
        }
        if (referencedObjs_1.length) {
            if (rest.match(/start/))
                ref = 'start';
            if (rest.match(/end/))
                ref = 'end';
            if (rest.match(/duration/))
                ref = 'duration';
            if (ref === 'duration') {
                // Duration refers to the first object on the resolved timeline
                var instanceDurations_1 = [];
                _.each(referencedObjs_1, function (referencedObj) {
                    resolveTimelineObj(resolvedTimeline, referencedObj);
                    if (referencedObj.resolved.resolved) {
                        var firstInstance = _.first(referencedObj.resolved.instances);
                        if (firstInstance) {
                            var duration = (firstInstance && firstInstance.end !== null ?
                                firstInstance.end - firstInstance.start :
                                null);
                            if (duration !== null) {
                                instanceDurations_1.push({
                                    value: duration,
                                    references: lib_1.joinReferences(referencedObj.id, firstInstance.references)
                                });
                            }
                        }
                    }
                });
                var firstDuration_1 = null;
                _.each(instanceDurations_1, function (d) {
                    if (firstDuration_1 === null || d.value < firstDuration_1.value)
                        firstDuration_1 = d;
                });
                return firstDuration_1;
            }
            else {
                var returnInstances_1 = [];
                if (ref === 'start') {
                    // nothing
                }
                else if (ref === 'end') {
                    invert = !invert;
                    ignoreFirstIfZero = true;
                }
                else
                    throw Error("Unknown ref: \"" + ref + "\"");
                _.each(referencedObjs_1, function (referencedObj) {
                    resolveTimelineObj(resolvedTimeline, referencedObj);
                    if (referencedObj.resolved.resolved) {
                        returnInstances_1 = returnInstances_1.concat(referencedObj.resolved.instances);
                    }
                });
                if (returnInstances_1.length) {
                    if (invert) {
                        returnInstances_1 = lib_1.invertInstances(returnInstances_1);
                    }
                    else {
                        returnInstances_1 = lib_1.cleanInstances(returnInstances_1, true, true);
                    }
                    if (ignoreFirstIfZero) {
                        var first = _.first(returnInstances_1);
                        if (first && first.start === 0) {
                            returnInstances_1.splice(0, 1);
                        }
                    }
                    return returnInstances_1;
                }
                else {
                    return null;
                }
            }
        }
        else {
            return null;
        }
    }
    else {
        if (expr) {
            var lookupExpr = {
                l: lookupExpression(resolvedTimeline, obj, expr.l, context),
                o: expr.o,
                r: lookupExpression(resolvedTimeline, obj, expr.r, context)
            };
            if (lookupExpr.o === '!') {
                // Discard l, invert and return r:
                if (lookupExpr.r && _.isArray(lookupExpr.r) && lookupExpr.r.length) {
                    return lib_1.invertInstances(lookupExpr.r);
                }
                else {
                    // We can't invert a value
                    return lookupExpr.r;
                }
            }
            else {
                if (_.isNull(lookupExpr.l) ||
                    _.isNull(lookupExpr.r)) {
                    return null;
                }
                if (lookupExpr.o === '&' ||
                    lookupExpr.o === '|') {
                    var events_2 = [];
                    var addEvents = function (instances, left) {
                        _.each(instances, function (instance) {
                            events_2.push({
                                left: left,
                                time: instance.start,
                                value: true,
                                references: [],
                                data: true,
                                instance: instance
                            });
                            if (instance.end !== null) {
                                events_2.push({
                                    left: left,
                                    time: instance.end,
                                    value: false,
                                    references: [],
                                    data: false,
                                    instance: instance
                                });
                            }
                        });
                    };
                    if (_.isArray(lookupExpr.l))
                        addEvents(lookupExpr.l, true);
                    if (_.isArray(lookupExpr.r))
                        addEvents(lookupExpr.r, false);
                    events_2 = lib_1.sortEvents(events_2);
                    var calcResult = (lookupExpr.o === '&' ?
                        function (left, right) { return !!(left && right); } :
                        lookupExpr.o === '|' ?
                            function (left, right) { return !!(left || right); } :
                            function () { return false; });
                    var leftValue = (lib_1.isReference(lookupExpr.l) ? !!lookupExpr.l.value : false);
                    var rightValue = (lib_1.isReference(lookupExpr.r) ? !!lookupExpr.r.value : false);
                    var leftInstance = null;
                    var rightInstance = null;
                    var resultValue = calcResult(leftValue, rightValue);
                    var resultReferences = lib_1.joinReferences((lib_1.isReference(lookupExpr.l) ? lookupExpr.l.references : []), (lib_1.isReference(lookupExpr.r) ? lookupExpr.r.references : []));
                    var instances_1 = [];
                    var updateInstance = function (time, value, references, caps) {
                        if (value) {
                            instances_1.push({
                                id: lib_1.getId(),
                                start: time,
                                end: null,
                                references: references,
                                caps: caps
                            });
                        }
                        else {
                            var last = _.last(instances_1);
                            if (last) {
                                last.end = time;
                                // don't update reference on end
                            }
                        }
                    };
                    updateInstance(0, resultValue, resultReferences, []);
                    for (var i = 0; i < events_2.length; i++) {
                        var e = events_2[i];
                        var next = events_2[i + 1];
                        if (e.left) {
                            leftValue = e.value;
                            leftInstance = e.instance;
                        }
                        else {
                            rightValue = e.value;
                            rightInstance = e.instance;
                        }
                        if (!next || next.time !== e.time) {
                            var newResultValue = calcResult(leftValue, rightValue);
                            var resultReferences_1 = lib_1.joinReferences(leftInstance ? leftInstance.references : [], rightInstance ? rightInstance.references : []);
                            var resultCaps = ((leftInstance ? leftInstance.caps || [] : []).concat(rightInstance ? rightInstance.caps || [] : []));
                            if (newResultValue !== resultValue) {
                                updateInstance(e.time, newResultValue, resultReferences_1, resultCaps);
                                resultValue = newResultValue;
                            }
                        }
                    }
                    return instances_1;
                }
                else {
                    var operateInner_1 = (lookupExpr.o === '+' ?
                        function (a, b) { return { value: a.value + b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                        lookupExpr.o === '-' ?
                            function (a, b) { return { value: a.value - b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                            lookupExpr.o === '*' ?
                                function (a, b) { return { value: a.value * b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                                lookupExpr.o === '/' ?
                                    function (a, b) { return { value: a.value / b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                                    lookupExpr.o === '%' ?
                                        function (a, b) { return { value: a.value % b.value, references: lib_1.joinReferences(a.references, b.references) }; } :
                                        function () { return null; });
                    var operate = function (a, b) {
                        if (a === null || b === null)
                            return null;
                        return operateInner_1(a, b);
                    };
                    var result = lib_1.operateOnArrays(lookupExpr.l, lookupExpr.r, operate);
                    return result;
                }
            }
        }
    }
    return null;
}
exports.lookupExpression = lookupExpression;

},{"../lib":7,"./common":8,"./expression":9,"./state":11,"./validate":12,"underscore":14}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var _ = require("underscore");
var common_1 = require("./common");
var enums_1 = require("../api/enums");
function getState(resolved, time, eventLimit) {
    if (eventLimit === void 0) { eventLimit = 0; }
    var resolvedStates = (isResolvedStates(resolved) ?
        resolved :
        resolveStates(resolved, time));
    var state = {
        time: time,
        layers: {},
        nextEvents: _.filter(resolvedStates.nextEvents, function (e) { return e.time > time; })
    };
    if (eventLimit)
        state.nextEvents = state.nextEvents.slice(0, eventLimit);
    _.each(_.keys(resolvedStates.layers), function (layer) {
        var o = getStateAtTime(resolvedStates.state, layer, time);
        if (o)
            state.layers[layer] = o;
    });
    return state;
}
exports.getState = getState;
function resolveStates(resolved, onlyForTime) {
    var resolvedStates = {
        options: resolved.options,
        statistics: resolved.statistics,
        // These will be re-created during the state-resolving:
        objects: {},
        classes: {},
        layers: {},
        state: {},
        nextEvents: []
    };
    var resolvedObjects = _.values(resolved.objects);
    // Sort to make sure parent groups are evaluated before their children:
    resolvedObjects.sort(function (a, b) {
        if ((a.resolved.levelDeep || 0) > (b.resolved.levelDeep || 0))
            return 1;
        if ((a.resolved.levelDeep || 0) < (b.resolved.levelDeep || 0))
            return -1;
        if (a.id > a.id)
            return 1;
        if (a.id < a.id)
            return -1;
        return 0;
    });
    // Step 1: Collect all points-of-interest (which points in time we want to evaluate)
    // and which instances that are interesting
    var pointsInTime = {};
    var eventObjectTimes = {};
    _.each(resolvedObjects, function (obj) {
        if (!obj.disabled &&
            obj.resolved.resolved &&
            !obj.resolved.isKeyframe) {
            var parentTimes_1 = getTimesFromParents(resolved, obj);
            if (obj.layer) { // if layer is empty, don't put in state
                _.each(obj.resolved.instances, function (instance) {
                    var useInstance = true;
                    if (onlyForTime) {
                        useInstance = ((instance.start || 0) <= onlyForTime &&
                            (instance.end || Infinity) > onlyForTime);
                    }
                    if (useInstance) {
                        var timeEvents_1 = [];
                        timeEvents_1.push({ time: instance.start, enable: true });
                        if (instance.end)
                            timeEvents_1.push({ time: instance.end, enable: false });
                        // Also include times from parents, as they could affect the state of this instance:
                        _.each(parentTimes_1, function (parentTime) {
                            if (parentTime && (parentTime.time > (instance.start || 0) &&
                                parentTime.time < (instance.end || Infinity))) {
                                timeEvents_1.push(parentTime);
                            }
                        });
                        // Save a reference to this instance on all points in time that could affect it:
                        _.each(timeEvents_1, function (timeEvent) {
                            if (!pointsInTime[timeEvent.time + ''])
                                pointsInTime[timeEvent.time + ''] = [];
                            pointsInTime[timeEvent.time + ''].push({ obj: obj, instance: instance, enable: timeEvent.enable });
                        });
                    }
                });
            }
        }
    });
    // Also add keyframes to pointsInTime:
    _.each(resolvedObjects, function (obj) {
        if (!obj.disabled &&
            obj.resolved.resolved &&
            obj.resolved.isKeyframe &&
            obj.resolved.parentId) {
            _.each(obj.resolved.instances, function (instance) {
                var timeEvents = [];
                if (instance.start) {
                    timeEvents.push({ time: instance.start, enable: true });
                }
                else {
                    timeEvents.push({ time: instance.start, enable: true });
                }
                _.each(timeEvents, function (timeEvent) {
                    if (!pointsInTime[timeEvent.time + ''])
                        pointsInTime[timeEvent.time + ''] = [];
                    pointsInTime[timeEvent.time + ''].push({ obj: obj, instance: instance, enable: timeEvent.enable });
                });
            });
        }
    });
    // Step 2: Resolve the state for the points-of-interest
    // This is done by sweeping the points-of-interest chronologically,
    // determining the state for every point in time by adding & removing objects from aspiringInstances
    // Then sorting it to determine who takes precedence
    var currentState = {};
    var activeObjIds = {};
    /** The objects in aspiringInstances  */
    var aspiringInstances = {};
    var keyframeEvents = [];
    var times = _.map(_.keys(pointsInTime), function (time) { return parseFloat(time); });
    // Sort chronologically:
    times.sort(function (a, b) {
        return a - b;
    });
    _.each(times, function (time) {
        var instancesToCheck = pointsInTime[time];
        var checkedObjectsThisTime = {};
        instancesToCheck.sort(function (a, b) {
            if (a.obj.resolved && b.obj.resolved) {
                // Keyframes comes last:
                if (a.obj.resolved.isKeyframe && !b.obj.resolved.isKeyframe)
                    return 1;
                if (!a.obj.resolved.isKeyframe && b.obj.resolved.isKeyframe)
                    return -1;
                // Ending events come before starting events:
                if (a.enable && !b.enable)
                    return 1;
                if (!a.enable && b.enable)
                    return -1;
                // Deeper objects (children in groups) comes later, we want to check the parent groups first:
                if ((a.obj.resolved.levelDeep || 0) > (b.obj.resolved.levelDeep || 0))
                    return 1;
                if ((a.obj.resolved.levelDeep || 0) < (b.obj.resolved.levelDeep || 0))
                    return -1;
            }
            return 0;
        });
        _.each(instancesToCheck, function (o) {
            var obj = o.obj;
            var instance = o.instance;
            var toBeEnabled = ((instance.start || 0) <= time &&
                (instance.end || Infinity) > time);
            var layer = obj.layer + '';
            if (!checkedObjectsThisTime[obj.id + '_' + instance.id + '_' + o.enable]) { // Only check each object and event-type once for every point in time
                checkedObjectsThisTime[obj.id + '_' + instance.id + '_' + o.enable] = true;
                if (!obj.resolved.isKeyframe) {
                    // If object has a parent, only set if parent is on a layer (if layer is set for parent)
                    if (toBeEnabled && obj.resolved.parentId) {
                        var parentObj = (obj.resolved.parentId ?
                            resolved.objects[obj.resolved.parentId] :
                            null);
                        toBeEnabled = !!(parentObj &&
                            (!parentObj.layer ||
                                activeObjIds[parentObj.id]));
                    }
                    if (!aspiringInstances[obj.layer])
                        aspiringInstances[obj.layer] = [];
                    if (toBeEnabled) {
                        // The instance wants to be enabled (is starting)
                        // Add to aspiringInstances:
                        aspiringInstances[obj.layer].push({ obj: obj, instance: instance });
                    }
                    else {
                        // The instance doesn't want to be enabled (is ending)
                        // Remove from aspiringInstances:
                        aspiringInstances[layer] = _.reject(aspiringInstances[layer] || [], function (o) { return o.obj.id === obj.id; });
                    }
                    // Evaluate the layer to determine who has the throne:
                    aspiringInstances[layer].sort(function (a, b) {
                        // Determine who takes precedence:
                        // First, sort using priority
                        if ((a.obj.priority || 0) < (b.obj.priority || 0))
                            return 1;
                        if ((a.obj.priority || 0) > (b.obj.priority || 0))
                            return -1;
                        // Then, sort using the start time
                        if ((a.instance.start || 0) < (b.instance.start || 0))
                            return 1;
                        if ((a.instance.start || 0) > (b.instance.start || 0))
                            return -1;
                        // Last resort: sort using id:
                        if (a.obj.id > b.obj.id)
                            return 1;
                        if (a.obj.id < b.obj.id)
                            return -1;
                        return 0;
                    });
                    // Now, the one on top has the throne
                    // Update current state:
                    var currentOnTopOfLayer = aspiringInstances[layer][0];
                    var prevObj = currentState[layer];
                    var replaceOldObj = (currentOnTopOfLayer &&
                        (!prevObj ||
                            prevObj.id !== currentOnTopOfLayer.obj.id ||
                            prevObj.instance.id !== currentOnTopOfLayer.instance.id));
                    var removeOldObj = (!currentOnTopOfLayer &&
                        prevObj);
                    if (replaceOldObj || removeOldObj) {
                        if (prevObj) {
                            // Cap the old instance, so it'll end at this point in time:
                            prevObj.instance.end = time;
                            // Update activeObjIds:
                            delete activeObjIds[prevObj.id];
                            // Add to nextEvents:
                            if (!onlyForTime ||
                                prevObj.instance.end > onlyForTime) {
                                resolvedStates.nextEvents.push({
                                    type: enums_1.EventType.END,
                                    time: prevObj.instance.end,
                                    objId: prevObj.id
                                });
                                eventObjectTimes[instance.end + ''] = enums_1.EventType.END;
                            }
                        }
                    }
                    if (replaceOldObj) {
                        // Set the new object to State
                        // Construct a new object clone:
                        var newObj_1;
                        if (resolvedStates.objects[currentOnTopOfLayer.obj.id]) {
                            // Use the already existing one
                            newObj_1 = resolvedStates.objects[currentOnTopOfLayer.obj.id];
                        }
                        else {
                            newObj_1 = _.clone(currentOnTopOfLayer.obj);
                            newObj_1.content = JSON.parse(JSON.stringify(newObj_1.content));
                            newObj_1.resolved = tslib_1.__assign({}, newObj_1.resolved || {}, { instances: [] });
                            common_1.addObjectToResolvedTimeline(resolvedStates, newObj_1);
                        }
                        var newInstance_1 = tslib_1.__assign({}, currentOnTopOfLayer.instance, { 
                            // We're setting new start & end times so they match up with the state:
                            start: time, end: null, fromInstanceId: currentOnTopOfLayer.instance.id });
                        // Make the instance id unique:
                        _.each(newObj_1.resolved.instances, function (instance) {
                            if (instance.id === newInstance_1.id) {
                                newInstance_1.id = newInstance_1.id + '_$' + newObj_1.resolved.instances.length;
                            }
                        });
                        newObj_1.resolved.instances.push(newInstance_1);
                        var newObjInstance = tslib_1.__assign({}, newObj_1, { instance: newInstance_1 });
                        // Save to current state:
                        currentState[layer] = newObjInstance;
                        // Update activeObjIds:
                        activeObjIds[newObjInstance.id] = newObjInstance;
                        // Update the tracking state as well:
                        setStateAtTime(resolvedStates.state, layer, time, newObjInstance);
                        // Add to nextEvents:
                        if (newInstance_1.start > (onlyForTime || 0)) {
                            resolvedStates.nextEvents.push({
                                type: enums_1.EventType.START,
                                time: newInstance_1.start,
                                objId: obj.id
                            });
                            eventObjectTimes[newInstance_1.start + ''] = enums_1.EventType.START;
                        }
                    }
                    else if (removeOldObj) {
                        // Remove from current state:
                        delete currentState[layer];
                        // Update the tracking state as well:
                        setStateAtTime(resolvedStates.state, layer, time, null);
                    }
                }
                else {
                    // Is a keyframe
                    var keyframe = obj;
                    // Add keyframe to resolvedStates.objects:
                    resolvedStates.objects[keyframe.id] = keyframe;
                    // Check if the keyframe's parent is currently active?
                    if (keyframe.resolved.parentId) {
                        var parentObj = activeObjIds[keyframe.resolved.parentId];
                        if (parentObj && parentObj.layer) { // keyframe is on an active object
                            var parentObjInstance = currentState[parentObj.layer];
                            if (parentObjInstance) {
                                var keyframeInstance = tslib_1.__assign({}, keyframe, { instance: instance, isKeyframe: true, keyframeEndTime: instance.end });
                                // Note: The keyframes are a little bit special, since their contents are applied to their parents.
                                // That application is done in the getStateAtTime function.
                                // Add keyframe to the tracking state:
                                addKeyframeAtTime(resolvedStates.state, parentObj.layer + '', time, keyframeInstance);
                                // Add keyframe to nextEvents:
                                keyframeEvents.push({
                                    type: enums_1.EventType.KEYFRAME,
                                    time: instance.start,
                                    objId: keyframe.id
                                });
                                if (instance.end !== null) {
                                    keyframeEvents.push({
                                        type: enums_1.EventType.KEYFRAME,
                                        time: instance.end,
                                        objId: keyframe.id
                                    });
                                }
                            }
                        }
                    }
                }
            }
        });
    });
    // Go through the keyframe events and add them to nextEvents:
    _.each(keyframeEvents, function (keyframeEvent) {
        // tslint:disable-next-line
        if (eventObjectTimes[keyframeEvent.time + ''] === undefined) { // no need to put a keyframe event if there's already another event there
            resolvedStates.nextEvents.push(keyframeEvent);
            eventObjectTimes[keyframeEvent.time + ''] = enums_1.EventType.KEYFRAME;
        }
    });
    if (onlyForTime) {
        resolvedStates.nextEvents = _.filter(resolvedStates.nextEvents, function (e) { return e.time > onlyForTime; });
    }
    resolvedStates.nextEvents.sort(function (a, b) {
        if (a.time > b.time)
            return 1;
        if (a.time < b.time)
            return -1;
        if (a.type > b.type)
            return -1;
        if (a.type < b.type)
            return 1;
        if (a.objId < b.objId)
            return -1;
        if (a.objId > b.objId)
            return 1;
        return 0;
    });
    return resolvedStates;
}
exports.resolveStates = resolveStates;
function applyKeyframeContent(parentContent, keyframeContent) {
    _.each(keyframeContent, function (value, attr) {
        if (_.isArray(value)) {
            if (!_.isArray(parentContent[attr]))
                parentContent[attr] = [];
            applyKeyframeContent(parentContent[attr], value);
            parentContent[attr].splice(value.length, 99999);
        }
        else if (_.isObject(value)) {
            if (!_.isObject(parentContent[attr]) ||
                _.isArray(parentContent[attr]))
                parentContent[attr] = {};
            applyKeyframeContent(parentContent[attr], value);
        }
        else {
            parentContent[attr] = value;
        }
    });
}
exports.applyKeyframeContent = applyKeyframeContent;
function getTimesFromParents(resolved, obj) {
    var times = [];
    var parentObj = (obj.resolved.parentId ?
        resolved.objects[obj.resolved.parentId] :
        null);
    if (parentObj && parentObj.resolved.resolved) {
        _.each(parentObj.resolved.instances, function (instance) {
            times.push({ time: instance.start, enable: true });
            if (instance.end)
                times.push({ time: instance.end, enable: false });
        });
        times = times.concat(getTimesFromParents(resolved, parentObj));
    }
    return times;
}
function setStateAtTime(states, layer, time, objInstance) {
    if (!states[layer])
        states[layer] = {};
    states[layer][time + ''] = objInstance ? [objInstance] : objInstance;
}
function addKeyframeAtTime(states, layer, time, objInstanceKf) {
    if (!states[layer])
        states[layer] = {};
    if (!states[layer][time + ''])
        states[layer][time + ''] = [];
    // @ts-ignore object is possibly null
    states[layer][time + ''].push(objInstanceKf);
}
function getStateAtTime(states, layer, requestTime) {
    var layerStates = states[layer] || {};
    var times = _.map(_.keys(layerStates), function (time) { return parseFloat(time); });
    times.sort(function (a, b) {
        return a - b;
    });
    var state = null;
    var isCloned = false;
    _.find(times, function (time) {
        if (time <= requestTime) {
            var currentStateInstances = layerStates[time + ''];
            if (currentStateInstances && currentStateInstances.length) {
                _.each(currentStateInstances, function (currentState) {
                    if (currentState &&
                        currentState.isKeyframe) {
                        var keyframe = currentState;
                        if (state && keyframe.resolved.parentId === state.id) {
                            if ((keyframe.keyframeEndTime || Infinity) > requestTime) {
                                if (!isCloned) {
                                    isCloned = true;
                                    state = tslib_1.__assign({}, state, { content: JSON.parse(JSON.stringify(state.content)) });
                                }
                                // Apply the keyframe on the state:
                                applyKeyframeContent(state.content, keyframe.content);
                            }
                        }
                    }
                    else {
                        state = currentState;
                        isCloned = false;
                    }
                });
            }
            else {
                state = null;
                isCloned = false;
            }
            return false;
        }
        else {
            return true;
        }
    });
    return state;
}
function isResolvedStates(resolved) {
    return !!(resolved &&
        typeof resolved === 'object' &&
        resolved.objects &&
        resolved.state &&
        resolved.nextEvents);
}

},{"../api/enums":5,"./common":8,"tslib":13,"underscore":14}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("underscore");
function validateObject0(obj, strict, uniqueIds) {
    if (!uniqueIds)
        uniqueIds = {};
    if (!obj)
        throw new Error("Object is undefined");
    if (!_.isObject(obj))
        throw new Error("Object is not an object");
    if (!obj.id)
        throw new Error("Object missing \"id\" attribute");
    if (!_.isString(obj.id))
        throw new Error("Object \"id\" attribute is not a string: \"" + obj.id + "\"");
    if (uniqueIds[obj.id])
        throw new Error("Object id \"" + obj.id + "\" is not unique");
    uniqueIds[obj.id] = true;
    // @ts-ignore
    if (obj.layer === undefined)
        throw new Error("Object \"" + obj.id + "\": \"layer\" attribute is undefined");
    if (!obj.content)
        throw new Error("Object \"" + obj.id + "\": \"content\" attribute must be set");
    if (!obj.enable)
        throw new Error("Object \"" + obj.id + "\": \"enable\" attribute must be set");
    if (obj.enable.start !== undefined) {
        if (strict && obj.enable.while !== undefined)
            throw new Error("Object \"" + obj.id + "\": \"enable.start\" and \"enable.while\" cannot be combined");
        if (strict &&
            obj.enable.end !== undefined &&
            obj.enable.duration !== undefined)
            throw new Error("Object \"" + obj.id + "\": \"enable.end\" and \"enable.duration\" cannot be combined");
    }
    else if (obj.enable.while !== undefined) {
        if (strict && obj.enable.end !== undefined)
            throw new Error("Object \"" + obj.id + "\": \"enable.while\" and \"enable.end\" cannot be combined");
        if (strict && obj.enable.duration !== undefined)
            throw new Error("Object \"" + obj.id + "\": \"enable.while\" and \"enable.duration\" cannot be combined");
    }
    else
        throw new Error("Object \"" + obj.id + "\": \"enable.start\" or \"enable.while\" must be set");
    if (obj.keyframes) {
        _.each(obj.keyframes, function (keyframe, i) {
            try {
                validateKeyframe0(keyframe, strict, uniqueIds);
            }
            catch (e) {
                throw new Error("Object \"" + obj.id + "\" keyframe[" + i + "]: " + e);
            }
        });
    }
    if (obj.classes) {
        _.each(obj.classes, function (className, i) {
            if (className && !_.isString(className))
                throw new Error("Object \"" + obj.id + "\": \"classes[" + i + "]\" is not a string");
        });
    }
    if (obj.children && !obj.isGroup)
        throw new Error("Object \"" + obj.id + "\": attribute \"children\" is set but \"isGroup\" is not");
    if (obj.isGroup && !obj.children)
        throw new Error("Object \"" + obj.id + "\": attribute \"isGroup\" is set but \"children\" missing");
    if (obj.children) {
        _.each(obj.children, function (child, i) {
            try {
                validateObject0(child, strict, uniqueIds);
            }
            catch (e) {
                throw new Error("Object \"" + obj.id + "\" child[" + i + "]: " + e);
            }
        });
    }
    if (obj.priority !== undefined && !_.isNumber(obj.priority))
        throw new Error("Object \"" + obj.id + "\": attribute \"priority\" is not a number");
}
function validateKeyframe0(keyframe, strict, uniqueIds) {
    if (!uniqueIds)
        uniqueIds = {};
    if (!keyframe)
        throw new Error("Keyframe is undefined");
    if (!_.isObject(keyframe))
        throw new Error("Keyframe is not an object");
    if (!keyframe.id)
        throw new Error("Keyframe missing id attribute");
    if (!_.isString(keyframe.id))
        throw new Error("Keyframe id attribute is not a string: \"" + keyframe.id + "\"");
    if (uniqueIds[keyframe.id])
        throw new Error("Keyframe id \"" + keyframe.id + "\" is not unique");
    uniqueIds[keyframe.id] = true;
    if (!keyframe.content)
        throw new Error("Keyframe \"" + keyframe.id + "\": \"content\" attribute must be set");
    if (!keyframe.enable)
        throw new Error("Keyframe \"" + keyframe.id + "\": \"enable\" attribute must be set");
    if (keyframe.enable.start !== undefined) {
        if (strict && keyframe.enable.while !== undefined)
            throw new Error("Keyframe \"" + keyframe.id + "\": \"enable.start\" and \"enable.while\" cannot be combined");
        if (strict &&
            keyframe.enable.end !== undefined &&
            keyframe.enable.duration !== undefined)
            throw new Error("Keyframe \"" + keyframe.id + "\": \"enable.end\" and \"enable.duration\" cannot be combined");
    }
    else if (keyframe.enable.while !== undefined) {
        if (strict && keyframe.enable.end !== undefined)
            throw new Error("Keyframe \"" + keyframe.id + "\": \"enable.while\" and \"enable.end\" cannot be combined");
        if (strict && keyframe.enable.duration !== undefined)
            throw new Error("Keyframe \"" + keyframe.id + "\": \"enable.while\" and \"enable.duration\" cannot be combined");
    }
    else
        throw new Error("Keyframe \"" + keyframe.id + "\": \"enable.start\" or \"enable.while\" must be set");
    if (keyframe.classes) {
        _.each(keyframe.classes, function (className, i) {
            if (className && !_.isString(className))
                throw new Error("Keyframe \"" + keyframe.id + "\": \"classes[" + i + "]\" is not a string");
        });
    }
}
/**
 * Validates all objects in the timeline. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some strict rules (rules that can possibly be ignored)
 */
function validateTimeline(timeline, strict) {
    var uniqueIds = {};
    _.each(timeline, function (obj) {
        validateObject0(obj, strict, uniqueIds);
    });
}
exports.validateTimeline = validateTimeline;
/**
 * Validates a Timeline-object. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some strict rules (rules that can possibly be ignored)
 */
function validateObject(obj, strict) {
    validateObject0(obj, strict);
}
exports.validateObject = validateObject;
/**
 * Validates a Timeline-keyframe. Throws an error if something's wrong
 * @param timeline The timeline to validate
 * @param strict Set to true to enable some strict rules (rules that can possibly be ignored)
 */
function validateKeyframe(keyframe, strict) {
    validateKeyframe0(keyframe, strict);
}
exports.validateKeyframe = validateKeyframe;

},{"underscore":14}],13:[function(require,module,exports){
(function (global){
/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
/* global global, define, System, Reflect, Promise */
var __extends;
var __assign;
var __rest;
var __decorate;
var __param;
var __metadata;
var __awaiter;
var __generator;
var __exportStar;
var __values;
var __read;
var __spread;
var __await;
var __asyncGenerator;
var __asyncDelegator;
var __asyncValues;
var __makeTemplateObject;
var __importStar;
var __importDefault;
(function (factory) {
    var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : {};
    if (typeof define === "function" && define.amd) {
        define("tslib", ["exports"], function (exports) { factory(createExporter(root, createExporter(exports))); });
    }
    else if (typeof module === "object" && typeof module.exports === "object") {
        factory(createExporter(root, createExporter(module.exports)));
    }
    else {
        factory(createExporter(root));
    }
    function createExporter(exports, previous) {
        if (exports !== root) {
            if (typeof Object.create === "function") {
                Object.defineProperty(exports, "__esModule", { value: true });
            }
            else {
                exports.__esModule = true;
            }
        }
        return function (id, v) { return exports[id] = previous ? previous(id, v) : v; };
    }
})
(function (exporter) {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };

    __extends = function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };

    __assign = Object.assign || function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };

    __rest = function (s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
                t[p[i]] = s[p[i]];
        return t;
    };

    __decorate = function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };

    __param = function (paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    };

    __metadata = function (metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    };

    __awaiter = function (thisArg, _arguments, P, generator) {
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };

    __generator = function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    };

    __exportStar = function (m, exports) {
        for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    };

    __values = function (o) {
        var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
        if (m) return m.call(o);
        return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
    };

    __read = function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };

    __spread = function () {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    };

    __await = function (v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    };

    __asyncGenerator = function (thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);  }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    };

    __asyncDelegator = function (o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    };

    __asyncValues = function (o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    };

    __makeTemplateObject = function (cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    };

    __importStar = function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result["default"] = mod;
        return result;
    };

    __importDefault = function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };

    exporter("__extends", __extends);
    exporter("__assign", __assign);
    exporter("__rest", __rest);
    exporter("__decorate", __decorate);
    exporter("__param", __param);
    exporter("__metadata", __metadata);
    exporter("__awaiter", __awaiter);
    exporter("__generator", __generator);
    exporter("__exportStar", __exportStar);
    exporter("__values", __values);
    exporter("__read", __read);
    exporter("__spread", __spread);
    exporter("__await", __await);
    exporter("__asyncGenerator", __asyncGenerator);
    exporter("__asyncDelegator", __asyncDelegator);
    exporter("__asyncValues", __asyncValues);
    exporter("__makeTemplateObject", __makeTemplateObject);
    exporter("__importStar", __importStar);
    exporter("__importDefault", __importDefault);
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],14:[function(require,module,exports){
(function (global){
//     Underscore.js 1.9.1
//     http://underscorejs.org
//     (c) 2009-2018 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server, or `this` in some virtual machines. We use `self`
  // instead of `window` for `WebWorker` support.
  var root = typeof self == 'object' && self.self === self && self ||
            typeof global == 'object' && global.global === global && global ||
            this ||
            {};

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;
  var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

  // Create quick reference variables for speed access to core prototypes.
  var push = ArrayProto.push,
      slice = ArrayProto.slice,
      toString = ObjProto.toString,
      hasOwnProperty = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var nativeIsArray = Array.isArray,
      nativeKeys = Object.keys,
      nativeCreate = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for their old module API. If we're in
  // the browser, add `_` as a global object.
  // (`nodeType` is checked to ensure that `module`
  // and `exports` are not HTML elements.)
  if (typeof exports != 'undefined' && !exports.nodeType) {
    if (typeof module != 'undefined' && !module.nodeType && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.9.1';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      // The 2-argument case is omitted because we’re not using it.
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  var builtinIteratee;

  // An internal function to generate callbacks that can be applied to each
  // element in a collection, returning the desired result — either `identity`,
  // an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value) && !_.isArray(value)) return _.matcher(value);
    return _.property(value);
  };

  // External wrapper for our callback generator. Users may customize
  // `_.iteratee` if they want additional predicate/iteratee shorthand styles.
  // This abstraction hides the internal-only argCount argument.
  _.iteratee = builtinIteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // Some functions take a variable number of arguments, or a few expected
  // arguments at the beginning and then a variable number of values to operate
  // on. This helper accumulates all remaining arguments past the function’s
  // argument length (or an explicit `startIndex`), into an array that becomes
  // the last argument. Similar to ES6’s "rest parameter".
  var restArguments = function(func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      var length = Math.max(arguments.length - startIndex, 0),
          rest = Array(length),
          index = 0;
      for (; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var shallowProperty = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  var has = function(obj, path) {
    return obj != null && hasOwnProperty.call(obj, path);
  }

  var deepGet = function(obj, path) {
    var length = path.length;
    for (var i = 0; i < length; i++) {
      if (obj == null) return void 0;
      obj = obj[path[i]];
    }
    return length ? obj : void 0;
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object.
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = shallowProperty('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  var createReduce = function(dir) {
    // Wrap code that reassigns argument variables in a separate function than
    // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
    var reducer = function(obj, iteratee, memo, initial) {
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      if (!initial) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    };

    return function(obj, iteratee, memo, context) {
      var initial = arguments.length >= 3;
      return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
    };
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
    var key = keyFinder(obj, predicate, context);
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = restArguments(function(obj, path, args) {
    var contextPath, func;
    if (_.isFunction(path)) {
      func = path;
    } else if (_.isArray(path)) {
      contextPath = path.slice(0, -1);
      path = path[path.length - 1];
    }
    return _.map(obj, function(context) {
      var method = func;
      if (!method) {
        if (contextPath && contextPath.length) {
          context = deepGet(context, contextPath);
        }
        if (context == null) return void 0;
        method = context[path];
      }
      return method == null ? method : method.apply(context, args);
    });
  });

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection.
  _.shuffle = function(obj) {
    return _.sample(obj, Infinity);
  };

  // Sample **n** random values from a collection using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
    var length = getLength(sample);
    n = Math.max(Math.min(n, length), 0);
    var last = length - 1;
    for (var index = 0; index < n; index++) {
      var rand = _.random(index, last);
      var temp = sample[index];
      sample[index] = sample[rand];
      sample[rand] = temp;
    }
    return sample.slice(0, n);
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    var index = 0;
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, key, list) {
      return {
        value: value,
        index: index++,
        criteria: iteratee(value, key, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior, partition) {
    return function(obj, iteratee, context) {
      var result = partition ? [[], []] : {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (has(result, key)) result[key]++; else result[key] = 1;
  });

  var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (_.isString(obj)) {
      // Keep surrogate pair characters together
      return obj.match(reStrSymbol);
    }
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = group(function(result, value, pass) {
    result[pass ? 0 : 1].push(value);
  }, true);

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null || array.length < 1) return n == null ? void 0 : [];
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null || array.length < 1) return n == null ? void 0 : [];
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, Boolean);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    output = output || [];
    var idx = output.length;
    for (var i = 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        // Flatten current level of array or arguments object.
        if (shallow) {
          var j = 0, len = value.length;
          while (j < len) output[idx++] = value[j++];
        } else {
          flatten(value, shallow, strict, output);
          idx = output.length;
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = restArguments(function(array, otherArrays) {
    return _.difference(array, otherArrays);
  });

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // The faster algorithm will not work with an iteratee if the iteratee
  // is not a one-to-one function, so providing an iteratee will disable
  // the faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted && !iteratee) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = restArguments(function(arrays) {
    return _.uniq(flatten(arrays, true, true));
  });

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      var j;
      for (j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = restArguments(function(array, rest) {
    rest = flatten(rest, true, true);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  });

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices.
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = restArguments(_.unzip);

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values. Passing by pairs is the reverse of _.pairs.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions.
  var createPredicateIndexFinder = function(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  };

  // Returns the first index on an array-like that passes a predicate test.
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions.
  var createIndexFinder = function(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    if (!step) {
      step = stop < start ? -1 : 1;
    }

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Chunk a single array into multiple arrays, each containing `count` or fewer
  // items.
  _.chunk = function(array, count) {
    if (count == null || count < 1) return [];
    var result = [];
    var i = 0, length = array.length;
    while (i < length) {
      result.push(slice.call(array, i, i += count));
    }
    return result;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments.
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = restArguments(function(func, context, args) {
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var bound = restArguments(function(callArgs) {
      return executeBound(func, bound, context, this, args.concat(callArgs));
    });
    return bound;
  });

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder by default, allowing any combination of arguments to be
  // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
  _.partial = restArguments(function(func, boundArgs) {
    var placeholder = _.partial.placeholder;
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  });

  _.partial.placeholder = _;

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = restArguments(function(obj, keys) {
    keys = flatten(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    while (index--) {
      var key = keys[index];
      obj[key] = _.bind(obj[key], obj);
    }
  });

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = restArguments(function(func, wait, args) {
    return setTimeout(function() {
      return func.apply(null, args);
    }, wait);
  });

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var timeout, context, args, result;
    var previous = 0;
    if (!options) options = {};

    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };

    var throttled = function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };

    throttled.cancel = function() {
      clearTimeout(timeout);
      previous = 0;
      timeout = context = args = null;
    };

    return throttled;
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;

    var later = function(context, args) {
      timeout = null;
      if (args) result = func.apply(context, args);
    };

    var debounced = restArguments(function(args) {
      if (timeout) clearTimeout(timeout);
      if (immediate) {
        var callNow = !timeout;
        timeout = setTimeout(later, wait);
        if (callNow) result = func.apply(this, args);
      } else {
        timeout = _.delay(later, wait, this, args);
      }

      return result;
    });

    debounced.cancel = function() {
      clearTimeout(timeout);
      timeout = null;
    };

    return debounced;
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  _.restArguments = restArguments;

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
    'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  var collectNonEnumProps = function(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  };

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`.
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object.
  // In contrast to _.map it returns an object.
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = _.keys(obj),
        length = keys.length,
        results = {};
    for (var index = 0; index < length; index++) {
      var currentKey = keys[index];
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  // The opposite of _.object.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`.
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, defaults) {
    return function(obj) {
      var length = arguments.length;
      if (defaults) obj = Object(obj);
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s).
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test.
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Internal pick helper function to determine if `obj` has key `key`.
  var keyInObj = function(value, key, obj) {
    return key in obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = restArguments(function(obj, keys) {
    var result = {}, iteratee = keys[0];
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
      keys = _.allKeys(obj);
    } else {
      iteratee = keyInObj;
      keys = flatten(keys, false, false);
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  });

  // Return a copy of the object without the blacklisted properties.
  _.omit = restArguments(function(obj, keys) {
    var iteratee = keys[0], context;
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
      if (keys.length > 1) context = keys[1];
    } else {
      keys = _.map(flatten(keys, false, false), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  });

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq, deepEq;
  eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // `null` or `undefined` only equal to itself (strict comparison).
    if (a == null || b == null) return false;
    // `NaN`s are equivalent, but non-reflexive.
    if (a !== a) return b !== b;
    // Exhaust primitive checks
    var type = typeof a;
    if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
    return deepEq(a, b, aStack, bStack);
  };

  // Internal recursive comparison function for `isEqual`.
  deepEq = function(a, b, aStack, bStack) {
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN.
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
      case '[object Symbol]':
        return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
  var nodelist = root.document && root.document.childNodes;
  if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, path) {
    if (!_.isArray(path)) {
      return has(obj, path);
    }
    var length = path.length;
    for (var i = 0; i < length; i++) {
      var key = path[i];
      if (obj == null || !hasOwnProperty.call(obj, key)) {
        return false;
      }
      obj = obj[key];
    }
    return !!length;
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  // Creates a function that, when passed an object, will traverse that object’s
  // properties down the given `path`, specified as an array of keys or indexes.
  _.property = function(path) {
    if (!_.isArray(path)) {
      return shallowProperty(path);
    }
    return function(obj) {
      return deepGet(obj, path);
    };
  };

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    if (obj == null) {
      return function(){};
    }
    return function(path) {
      return !_.isArray(path) ? obj[path] : deepGet(obj, path);
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

  // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped.
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // Traverses the children of `obj` along `path`. If a child is a function, it
  // is invoked with its parent as context. Returns the value of the final
  // child, or `fallback` if any child is undefined.
  _.result = function(obj, path, fallback) {
    if (!_.isArray(path)) path = [path];
    var length = path.length;
    if (!length) {
      return _.isFunction(fallback) ? fallback.call(obj) : fallback;
    }
    for (var i = 0; i < length; i++) {
      var prop = obj == null ? void 0 : obj[path[i]];
      if (prop === void 0) {
        prop = fallback;
        i = length; // Ensure we don't continue iterating.
      }
      obj = _.isFunction(prop) ? prop.call(obj) : prop;
    }
    return obj;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate: /<%([\s\S]+?)%>/g,
    interpolate: /<%=([\s\S]+?)%>/g,
    escape: /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offset.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    var render;
    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var chainResult = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return chainResult(this, func.apply(_, args));
      };
    });
    return _;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return chainResult(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return chainResult(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return String(this._wrapped);
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define == 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[1])(1)
});

//# sourceMappingURL=timeline-visualizer.js.map
