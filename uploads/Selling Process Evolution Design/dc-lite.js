/* dc-lite — a tiny, eval-free renderer for the .dc.html apps.
   Replaces support.js (which used Babel + eval and is blocked by strict CSP).
   Interprets the <x-dc> template: {{ path }} bindings, sc-for, sc-if,
   onClick/onChange/onKeyDown, value, placeholder, ref/sc-ref, style-hover/focus.
   The component's modern JS runs natively (classic <script>, no transpile). */
(function () {
  "use strict";
  var registry = null;

  function resolve(scope, path) {
    if (path.indexOf(".") < 0) return scope[path];
    var parts = path.split("."), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  var RE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  function interp(str, scope) {
    return str.replace(RE, function (_, p) { var v = resolve(scope, p); return v == null ? "" : String(v); });
  }
  function fullBinding(str) { var m = /^\{\{\s*([\w.$]+)\s*\}\}$/.exec(str); return m ? m[1] : null; }

  var EVENTS = { onclick: "click", onchange: "input", onkeydown: "keydown", oninput: "input", onblur: "blur", onfocus: "focus" };

  function processNode(node, scope, out, inst) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();

    if (tag === "sc-for") {
      var lp = fullBinding(node.getAttribute("list") || ""), asName = node.getAttribute("as");
      var list = lp ? resolve(scope, lp) : null;
      if (Array.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
          var cs = Object.assign({}, scope); cs[asName] = list[i]; cs.$index = i;
          for (var c = 0; c < node.childNodes.length; c++) processNode(node.childNodes[c], cs, out, inst);
        }
      }
      return;
    }
    if (tag === "sc-if") {
      var vp = fullBinding(node.getAttribute("value") || "");
      if (vp ? resolve(scope, vp) : false)
        for (var k = 0; k < node.childNodes.length; k++) processNode(node.childNodes[k], scope, out, inst);
      return;
    }
    if (tag === "sc-html") {                      // render a bound HTML string as real DOM
      var hp = fullBinding(node.getAttribute("value") || "");
      var html = hp ? resolve(scope, hp) : "";
      var w = document.createElement("div");
      var sty = node.getAttribute("style"); if (sty) w.setAttribute("style", interp(sty, scope));
      w.innerHTML = (html == null ? "" : String(html));
      out.appendChild(w);
      return;
    }

    var el = document.createElement(tag);
    var baseStyle = null, hoverStyle = null, focusStyle = null;
    for (var a = 0; a < node.attributes.length; a++) {
      var name = node.attributes[a].name, val = node.attributes[a].value, ln = name.toLowerCase();
      if (name.indexOf("hint-placeholder") === 0) continue;
      if (EVENTS.hasOwnProperty(ln)) {
        var fp = fullBinding(val), fn = fp ? resolve(scope, fp) : null;
        if (typeof fn === "function") (function (f, ev) { el.addEventListener(ev, function (e) { f(e); }); })(fn, EVENTS[ln]);
        continue;
      }
      if (name === "style-hover") { hoverStyle = interp(val, scope); continue; }
      if (name === "style-focus") { focusStyle = interp(val, scope); continue; }
      if (name === "ref") { var rp = fullBinding(val), rf = rp ? resolve(scope, rp) : null; if (typeof rf === "function") rf(el); continue; }
      if (name === "sc-ref") { inst.refs[val] = el; continue; }
      if (name === "value") { el.value = interp(val, scope); continue; }
      if (name === "placeholder") { el.setAttribute("placeholder", interp(val, scope)); continue; }
      if (name === "style") { baseStyle = interp(val, scope); el.setAttribute("style", baseStyle); continue; }
      el.setAttribute(name, interp(val, scope));
    }
    if (hoverStyle !== null) {
      el.addEventListener("mouseenter", function () { el.setAttribute("style", (baseStyle || "") + ";" + hoverStyle); });
      el.addEventListener("mouseleave", function () { el.setAttribute("style", baseStyle || ""); });
    }
    if (focusStyle !== null) {
      el.addEventListener("focus", function () { el.setAttribute("style", (baseStyle || "") + ";" + focusStyle); });
      el.addEventListener("blur", function () { el.setAttribute("style", baseStyle || ""); });
    }
    for (var ch = 0; ch < node.childNodes.length; ch++) processNode(node.childNodes[ch], scope, el, inst);
    out.appendChild(el);
  }

  function DCLogic(props) { this.props = props || {}; this.state = {}; this.refs = {}; }
  DCLogic.prototype.setState = function (partial) {
    var p = (typeof partial === "function") ? partial(this.state) : partial;
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) this.state[k] = p[k];
    if (this.__update) this.__update();
  };
  DCLogic.prototype.renderVals = function () { return {}; };
  window.DCLogic = DCLogic;
  window.StreamableLogic = DCLogic;

  window.__dcRegister = function (C) { registry = C; };

  function boot() {
    var xdc = document.querySelector("x-dc");
    if (!xdc || !registry) return;
    var helmet = xdc.querySelector("helmet");
    if (helmet) { while (helmet.firstChild) document.head.appendChild(helmet.firstChild); helmet.parentNode.removeChild(helmet); }
    var tpl = document.createDocumentFragment();
    var kids = Array.prototype.slice.call(xdc.childNodes);
    for (var i = 0; i < kids.length; i++) tpl.appendChild(kids[i]);

    var inst = new registry({});
    if (!inst.refs) inst.refs = {};
    var mounted = false;
    function render() {
      var ae = document.activeElement;
      var wasInput = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA") && xdc.contains(ae);
      var caret = null; if (wasInput) { try { caret = [ae.selectionStart, ae.selectionEnd]; } catch (e) {} }
      var vals = inst.renderVals ? inst.renderVals() : {};
      var frag = document.createDocumentFragment();
      for (var i = 0; i < tpl.childNodes.length; i++) processNode(tpl.childNodes[i], vals, frag, inst);
      xdc.textContent = "";
      xdc.appendChild(frag);
      if (wasInput) { var ni = xdc.querySelector("input,textarea"); if (ni) { ni.focus(); if (caret) try { ni.setSelectionRange(caret[0], caret[1]); } catch (e) {} } }
      if (mounted && inst.componentDidUpdate) inst.componentDidUpdate();
    }
    inst.__update = render;
    render();
    mounted = true;
    if (inst.componentDidMount) inst.componentDidMount();
  }

  if (document.readyState !== "loading") setTimeout(boot, 0);
  else document.addEventListener("DOMContentLoaded", boot);
})();
