import { bh as define, bi as extend, bj as Rgb, bk as Color, bl as rgbConvert, bm as nogamma, bn as hue, _ as __name, bo as dayjs2, y as getConfig2, u as setAccTitle, v as getAccTitle, N as setDiagramTitle, O as getDiagramTitle, x as setAccDescription, w as getAccDescription, T as clear, I as sanitizeUrl_1, G as log, F as select, H as configureSvgSize, A as common_default, S as utils_default } from './index-CZEwXjve.js';
import { c as commonjsGlobal, a as getDefaultExportFromCjs } from './worker-CBGrwT8c.js';
import { b as bisector, t as tickStep, c as continuous, a as copy, l as linear } from './linear-Bbt9jOot.js';
import { i as initRange } from './init-zpY4DTin.js';

function max(values, valueof) {
  let max;
  if (valueof === undefined) {
    for (const value of values) {
      if (value != null
          && (max < value || (max === undefined && value >= value))) {
        max = value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null
          && (max < value || (max === undefined && value >= value))) {
        max = value;
      }
    }
  }
  return max;
}

function min(values, valueof) {
  let min;
  if (valueof === undefined) {
    for (const value of values) {
      if (value != null
          && (min > value || (min === undefined && value >= value))) {
        min = value;
      }
    }
  } else {
    let index = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index, values)) != null
          && (min > value || (min === undefined && value >= value))) {
        min = value;
      }
    }
  }
  return min;
}

function identity(x) {
  return x;
}

var top = 1,
    right = 2,
    bottom = 3,
    left = 4,
    epsilon = 1e-6;

function translateX(x) {
  return "translate(" + x + ",0)";
}

function translateY(y) {
  return "translate(0," + y + ")";
}

function number$1(scale) {
  return d => +scale(d);
}

function center(scale, offset) {
  offset = Math.max(0, scale.bandwidth() - offset * 2) / 2;
  if (scale.round()) offset = Math.round(offset);
  return d => +scale(d) + offset;
}

function entering() {
  return !this.__axis;
}

function axis(orient, scale) {
  var tickArguments = [],
      tickValues = null,
      tickFormat = null,
      tickSizeInner = 6,
      tickSizeOuter = 6,
      tickPadding = 3,
      offset = typeof window !== "undefined" && window.devicePixelRatio > 1 ? 0 : 0.5,
      k = orient === top || orient === left ? -1 : 1,
      x = orient === left || orient === right ? "x" : "y",
      transform = orient === top || orient === bottom ? translateX : translateY;

  function axis(context) {
    var values = tickValues == null ? (scale.ticks ? scale.ticks.apply(scale, tickArguments) : scale.domain()) : tickValues,
        format = tickFormat == null ? (scale.tickFormat ? scale.tickFormat.apply(scale, tickArguments) : identity) : tickFormat,
        spacing = Math.max(tickSizeInner, 0) + tickPadding,
        range = scale.range(),
        range0 = +range[0] + offset,
        range1 = +range[range.length - 1] + offset,
        position = (scale.bandwidth ? center : number$1)(scale.copy(), offset),
        selection = context.selection ? context.selection() : context,
        path = selection.selectAll(".domain").data([null]),
        tick = selection.selectAll(".tick").data(values, scale).order(),
        tickExit = tick.exit(),
        tickEnter = tick.enter().append("g").attr("class", "tick"),
        line = tick.select("line"),
        text = tick.select("text");

    path = path.merge(path.enter().insert("path", ".tick")
        .attr("class", "domain")
        .attr("stroke", "currentColor"));

    tick = tick.merge(tickEnter);

    line = line.merge(tickEnter.append("line")
        .attr("stroke", "currentColor")
        .attr(x + "2", k * tickSizeInner));

    text = text.merge(tickEnter.append("text")
        .attr("fill", "currentColor")
        .attr(x, k * spacing)
        .attr("dy", orient === top ? "0em" : orient === bottom ? "0.71em" : "0.32em"));

    if (context !== selection) {
      path = path.transition(context);
      tick = tick.transition(context);
      line = line.transition(context);
      text = text.transition(context);

      tickExit = tickExit.transition(context)
          .attr("opacity", epsilon)
          .attr("transform", function(d) { return isFinite(d = position(d)) ? transform(d + offset) : this.getAttribute("transform"); });

      tickEnter
          .attr("opacity", epsilon)
          .attr("transform", function(d) { var p = this.parentNode.__axis; return transform((p && isFinite(p = p(d)) ? p : position(d)) + offset); });
    }

    tickExit.remove();

    path
        .attr("d", orient === left || orient === right
            ? (tickSizeOuter ? "M" + k * tickSizeOuter + "," + range0 + "H" + offset + "V" + range1 + "H" + k * tickSizeOuter : "M" + offset + "," + range0 + "V" + range1)
            : (tickSizeOuter ? "M" + range0 + "," + k * tickSizeOuter + "V" + offset + "H" + range1 + "V" + k * tickSizeOuter : "M" + range0 + "," + offset + "H" + range1));

    tick
        .attr("opacity", 1)
        .attr("transform", function(d) { return transform(position(d) + offset); });

    line
        .attr(x + "2", k * tickSizeInner);

    text
        .attr(x, k * spacing)
        .text(format);

    selection.filter(entering)
        .attr("fill", "none")
        .attr("font-size", 10)
        .attr("font-family", "sans-serif")
        .attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");

    selection
        .each(function() { this.__axis = position; });
  }

  axis.scale = function(_) {
    return arguments.length ? (scale = _, axis) : scale;
  };

  axis.ticks = function() {
    return tickArguments = Array.from(arguments), axis;
  };

  axis.tickArguments = function(_) {
    return arguments.length ? (tickArguments = _ == null ? [] : Array.from(_), axis) : tickArguments.slice();
  };

  axis.tickValues = function(_) {
    return arguments.length ? (tickValues = _ == null ? null : Array.from(_), axis) : tickValues && tickValues.slice();
  };

  axis.tickFormat = function(_) {
    return arguments.length ? (tickFormat = _, axis) : tickFormat;
  };

  axis.tickSize = function(_) {
    return arguments.length ? (tickSizeInner = tickSizeOuter = +_, axis) : tickSizeInner;
  };

  axis.tickSizeInner = function(_) {
    return arguments.length ? (tickSizeInner = +_, axis) : tickSizeInner;
  };

  axis.tickSizeOuter = function(_) {
    return arguments.length ? (tickSizeOuter = +_, axis) : tickSizeOuter;
  };

  axis.tickPadding = function(_) {
    return arguments.length ? (tickPadding = +_, axis) : tickPadding;
  };

  axis.offset = function(_) {
    return arguments.length ? (offset = +_, axis) : offset;
  };

  return axis;
}

function axisTop(scale) {
  return axis(top, scale);
}

function axisBottom(scale) {
  return axis(bottom, scale);
}

const radians = Math.PI / 180;
const degrees = 180 / Math.PI;

// https://observablehq.com/@mbostock/lab-and-rgb
const K = 18,
    Xn = 0.96422,
    Yn = 1,
    Zn = 0.82521,
    t0$1 = 4 / 29,
    t1$1 = 6 / 29,
    t2 = 3 * t1$1 * t1$1,
    t3 = t1$1 * t1$1 * t1$1;

function labConvert(o) {
  if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
  if (o instanceof Hcl) return hcl2lab(o);
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var r = rgb2lrgb(o.r),
      g = rgb2lrgb(o.g),
      b = rgb2lrgb(o.b),
      y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn), x, z;
  if (r === g && g === b) x = z = y; else {
    x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
    z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
  }
  return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
}

function lab(l, a, b, opacity) {
  return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
}

function Lab(l, a, b, opacity) {
  this.l = +l;
  this.a = +a;
  this.b = +b;
  this.opacity = +opacity;
}

define(Lab, lab, extend(Color, {
  brighter(k) {
    return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  darker(k) {
    return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  rgb() {
    var y = (this.l + 16) / 116,
        x = isNaN(this.a) ? y : y + this.a / 500,
        z = isNaN(this.b) ? y : y - this.b / 200;
    x = Xn * lab2xyz(x);
    y = Yn * lab2xyz(y);
    z = Zn * lab2xyz(z);
    return new Rgb(
      lrgb2rgb( 3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
      lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
      lrgb2rgb( 0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
      this.opacity
    );
  }
}));

function xyz2lab(t) {
  return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0$1;
}

function lab2xyz(t) {
  return t > t1$1 ? t * t * t : t2 * (t - t0$1);
}

function lrgb2rgb(x) {
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function rgb2lrgb(x) {
  return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function hclConvert(o) {
  if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
  if (!(o instanceof Lab)) o = labConvert(o);
  if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0 < o.l && o.l < 100 ? 0 : NaN, o.l, o.opacity);
  var h = Math.atan2(o.b, o.a) * degrees;
  return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
}

function hcl$1(h, c, l, opacity) {
  return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
}

function Hcl(h, c, l, opacity) {
  this.h = +h;
  this.c = +c;
  this.l = +l;
  this.opacity = +opacity;
}

function hcl2lab(o) {
  if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
  var h = o.h * radians;
  return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
}

define(Hcl, hcl$1, extend(Color, {
  brighter(k) {
    return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
  },
  darker(k) {
    return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
  },
  rgb() {
    return hcl2lab(this).rgb();
  }
}));

function hcl(hue) {
  return function(start, end) {
    var h = hue((start = hcl$1(start)).h, (end = hcl$1(end)).h),
        c = nogamma(start.c, end.c),
        l = nogamma(start.l, end.l),
        opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.h = h(t);
      start.c = c(t);
      start.l = l(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }
}

const interpolateHcl = hcl(hue);

function nice(domain, interval) {
  domain = domain.slice();

  var i0 = 0,
      i1 = domain.length - 1,
      x0 = domain[i0],
      x1 = domain[i1],
      t;

  if (x1 < x0) {
    t = i0, i0 = i1, i1 = t;
    t = x0, x0 = x1, x1 = t;
  }

  domain[i0] = interval.floor(x0);
  domain[i1] = interval.ceil(x1);
  return domain;
}

const t0 = new Date, t1 = new Date;

function timeInterval(floori, offseti, count, field) {

  function interval(date) {
    return floori(date = arguments.length === 0 ? new Date : new Date(+date)), date;
  }

  interval.floor = (date) => {
    return floori(date = new Date(+date)), date;
  };

  interval.ceil = (date) => {
    return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
  };

  interval.round = (date) => {
    const d0 = interval(date), d1 = interval.ceil(date);
    return date - d0 < d1 - date ? d0 : d1;
  };

  interval.offset = (date, step) => {
    return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
  };

  interval.range = (start, stop, step) => {
    const range = [];
    start = interval.ceil(start);
    step = step == null ? 1 : Math.floor(step);
    if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
    let previous;
    do range.push(previous = new Date(+start)), offseti(start, step), floori(start);
    while (previous < start && start < stop);
    return range;
  };

  interval.filter = (test) => {
    return timeInterval((date) => {
      if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
    }, (date, step) => {
      if (date >= date) {
        if (step < 0) while (++step <= 0) {
          while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty
        } else while (--step >= 0) {
          while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty
        }
      }
    });
  };

  if (count) {
    interval.count = (start, end) => {
      t0.setTime(+start), t1.setTime(+end);
      floori(t0), floori(t1);
      return Math.floor(count(t0, t1));
    };

    interval.every = (step) => {
      step = Math.floor(step);
      return !isFinite(step) || !(step > 0) ? null
          : !(step > 1) ? interval
          : interval.filter(field
              ? (d) => field(d) % step === 0
              : (d) => interval.count(0, d) % step === 0);
    };
  }

  return interval;
}

const millisecond = timeInterval(() => {
  // noop
}, (date, step) => {
  date.setTime(+date + step);
}, (start, end) => {
  return end - start;
});

// An optimized implementation for this simple case.
millisecond.every = (k) => {
  k = Math.floor(k);
  if (!isFinite(k) || !(k > 0)) return null;
  if (!(k > 1)) return millisecond;
  return timeInterval((date) => {
    date.setTime(Math.floor(date / k) * k);
  }, (date, step) => {
    date.setTime(+date + step * k);
  }, (start, end) => {
    return (end - start) / k;
  });
};

millisecond.range;

const durationSecond = 1000;
const durationMinute = durationSecond * 60;
const durationHour = durationMinute * 60;
const durationDay = durationHour * 24;
const durationWeek = durationDay * 7;
const durationMonth = durationDay * 30;
const durationYear = durationDay * 365;

const second = timeInterval((date) => {
  date.setTime(date - date.getMilliseconds());
}, (date, step) => {
  date.setTime(+date + step * durationSecond);
}, (start, end) => {
  return (end - start) / durationSecond;
}, (date) => {
  return date.getUTCSeconds();
});

second.range;

const timeMinute = timeInterval((date) => {
  date.setTime(date - date.getMilliseconds() - date.getSeconds() * durationSecond);
}, (date, step) => {
  date.setTime(+date + step * durationMinute);
}, (start, end) => {
  return (end - start) / durationMinute;
}, (date) => {
  return date.getMinutes();
});

timeMinute.range;

const utcMinute = timeInterval((date) => {
  date.setUTCSeconds(0, 0);
}, (date, step) => {
  date.setTime(+date + step * durationMinute);
}, (start, end) => {
  return (end - start) / durationMinute;
}, (date) => {
  return date.getUTCMinutes();
});

utcMinute.range;

const timeHour = timeInterval((date) => {
  date.setTime(date - date.getMilliseconds() - date.getSeconds() * durationSecond - date.getMinutes() * durationMinute);
}, (date, step) => {
  date.setTime(+date + step * durationHour);
}, (start, end) => {
  return (end - start) / durationHour;
}, (date) => {
  return date.getHours();
});

timeHour.range;

const utcHour = timeInterval((date) => {
  date.setUTCMinutes(0, 0, 0);
}, (date, step) => {
  date.setTime(+date + step * durationHour);
}, (start, end) => {
  return (end - start) / durationHour;
}, (date) => {
  return date.getUTCHours();
});

utcHour.range;

const timeDay = timeInterval(
  date => date.setHours(0, 0, 0, 0),
  (date, step) => date.setDate(date.getDate() + step),
  (start, end) => (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay,
  date => date.getDate() - 1
);

timeDay.range;

const utcDay = timeInterval((date) => {
  date.setUTCHours(0, 0, 0, 0);
}, (date, step) => {
  date.setUTCDate(date.getUTCDate() + step);
}, (start, end) => {
  return (end - start) / durationDay;
}, (date) => {
  return date.getUTCDate() - 1;
});

utcDay.range;

const unixDay = timeInterval((date) => {
  date.setUTCHours(0, 0, 0, 0);
}, (date, step) => {
  date.setUTCDate(date.getUTCDate() + step);
}, (start, end) => {
  return (end - start) / durationDay;
}, (date) => {
  return Math.floor(date / durationDay);
});

unixDay.range;

function timeWeekday(i) {
  return timeInterval((date) => {
    date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
    date.setHours(0, 0, 0, 0);
  }, (date, step) => {
    date.setDate(date.getDate() + step * 7);
  }, (start, end) => {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
  });
}

const timeSunday = timeWeekday(0);
const timeMonday = timeWeekday(1);
const timeTuesday = timeWeekday(2);
const timeWednesday = timeWeekday(3);
const timeThursday = timeWeekday(4);
const timeFriday = timeWeekday(5);
const timeSaturday = timeWeekday(6);

timeSunday.range;
timeMonday.range;
timeTuesday.range;
timeWednesday.range;
timeThursday.range;
timeFriday.range;
timeSaturday.range;

function utcWeekday(i) {
  return timeInterval((date) => {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
    date.setUTCHours(0, 0, 0, 0);
  }, (date, step) => {
    date.setUTCDate(date.getUTCDate() + step * 7);
  }, (start, end) => {
    return (end - start) / durationWeek;
  });
}

const utcSunday = utcWeekday(0);
const utcMonday = utcWeekday(1);
const utcTuesday = utcWeekday(2);
const utcWednesday = utcWeekday(3);
const utcThursday = utcWeekday(4);
const utcFriday = utcWeekday(5);
const utcSaturday = utcWeekday(6);

utcSunday.range;
utcMonday.range;
utcTuesday.range;
utcWednesday.range;
utcThursday.range;
utcFriday.range;
utcSaturday.range;

const timeMonth = timeInterval((date) => {
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
}, (date, step) => {
  date.setMonth(date.getMonth() + step);
}, (start, end) => {
  return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
}, (date) => {
  return date.getMonth();
});

timeMonth.range;

const utcMonth = timeInterval((date) => {
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
}, (date, step) => {
  date.setUTCMonth(date.getUTCMonth() + step);
}, (start, end) => {
  return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
}, (date) => {
  return date.getUTCMonth();
});

utcMonth.range;

const timeYear = timeInterval((date) => {
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
}, (date, step) => {
  date.setFullYear(date.getFullYear() + step);
}, (start, end) => {
  return end.getFullYear() - start.getFullYear();
}, (date) => {
  return date.getFullYear();
});

// An optimized implementation for this simple case.
timeYear.every = (k) => {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date) => {
    date.setFullYear(Math.floor(date.getFullYear() / k) * k);
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, (date, step) => {
    date.setFullYear(date.getFullYear() + step * k);
  });
};

timeYear.range;

const utcYear = timeInterval((date) => {
  date.setUTCMonth(0, 1);
  date.setUTCHours(0, 0, 0, 0);
}, (date, step) => {
  date.setUTCFullYear(date.getUTCFullYear() + step);
}, (start, end) => {
  return end.getUTCFullYear() - start.getUTCFullYear();
}, (date) => {
  return date.getUTCFullYear();
});

// An optimized implementation for this simple case.
utcYear.every = (k) => {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date) => {
    date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, (date, step) => {
    date.setUTCFullYear(date.getUTCFullYear() + step * k);
  });
};

utcYear.range;

function ticker(year, month, week, day, hour, minute) {

  const tickIntervals = [
    [second,  1,      durationSecond],
    [second,  5,  5 * durationSecond],
    [second, 15, 15 * durationSecond],
    [second, 30, 30 * durationSecond],
    [minute,  1,      durationMinute],
    [minute,  5,  5 * durationMinute],
    [minute, 15, 15 * durationMinute],
    [minute, 30, 30 * durationMinute],
    [  hour,  1,      durationHour  ],
    [  hour,  3,  3 * durationHour  ],
    [  hour,  6,  6 * durationHour  ],
    [  hour, 12, 12 * durationHour  ],
    [   day,  1,      durationDay   ],
    [   day,  2,  2 * durationDay   ],
    [  week,  1,      durationWeek  ],
    [ month,  1,      durationMonth ],
    [ month,  3,  3 * durationMonth ],
    [  year,  1,      durationYear  ]
  ];

  function ticks(start, stop, count) {
    const reverse = stop < start;
    if (reverse) [start, stop] = [stop, start];
    const interval = count && typeof count.range === "function" ? count : tickInterval(start, stop, count);
    const ticks = interval ? interval.range(start, +stop + 1) : []; // inclusive stop
    return reverse ? ticks.reverse() : ticks;
  }

  function tickInterval(start, stop, count) {
    const target = Math.abs(stop - start) / count;
    const i = bisector(([,, step]) => step).right(tickIntervals, target);
    if (i === tickIntervals.length) return year.every(tickStep(start / durationYear, stop / durationYear, count));
    if (i === 0) return millisecond.every(Math.max(tickStep(start, stop, count), 1));
    const [t, step] = tickIntervals[target / tickIntervals[i - 1][2] < tickIntervals[i][2] / target ? i - 1 : i];
    return t.every(step);
  }

  return [ticks, tickInterval];
}
const [timeTicks, timeTickInterval] = ticker(timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute);

function localDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
    date.setFullYear(d.y);
    return date;
  }
  return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
}

function utcDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
    date.setUTCFullYear(d.y);
    return date;
  }
  return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
}

function newDate(y, m, d) {
  return {y: y, m: m, d: d, H: 0, M: 0, S: 0, L: 0};
}

function formatLocale(locale) {
  var locale_dateTime = locale.dateTime,
      locale_date = locale.date,
      locale_time = locale.time,
      locale_periods = locale.periods,
      locale_weekdays = locale.days,
      locale_shortWeekdays = locale.shortDays,
      locale_months = locale.months,
      locale_shortMonths = locale.shortMonths;

  var periodRe = formatRe(locale_periods),
      periodLookup = formatLookup(locale_periods),
      weekdayRe = formatRe(locale_weekdays),
      weekdayLookup = formatLookup(locale_weekdays),
      shortWeekdayRe = formatRe(locale_shortWeekdays),
      shortWeekdayLookup = formatLookup(locale_shortWeekdays),
      monthRe = formatRe(locale_months),
      monthLookup = formatLookup(locale_months),
      shortMonthRe = formatRe(locale_shortMonths),
      shortMonthLookup = formatLookup(locale_shortMonths);

  var formats = {
    "a": formatShortWeekday,
    "A": formatWeekday,
    "b": formatShortMonth,
    "B": formatMonth,
    "c": null,
    "d": formatDayOfMonth,
    "e": formatDayOfMonth,
    "f": formatMicroseconds,
    "g": formatYearISO,
    "G": formatFullYearISO,
    "H": formatHour24,
    "I": formatHour12,
    "j": formatDayOfYear,
    "L": formatMilliseconds,
    "m": formatMonthNumber,
    "M": formatMinutes,
    "p": formatPeriod,
    "q": formatQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatSeconds,
    "u": formatWeekdayNumberMonday,
    "U": formatWeekNumberSunday,
    "V": formatWeekNumberISO,
    "w": formatWeekdayNumberSunday,
    "W": formatWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatYear,
    "Y": formatFullYear,
    "Z": formatZone,
    "%": formatLiteralPercent
  };

  var utcFormats = {
    "a": formatUTCShortWeekday,
    "A": formatUTCWeekday,
    "b": formatUTCShortMonth,
    "B": formatUTCMonth,
    "c": null,
    "d": formatUTCDayOfMonth,
    "e": formatUTCDayOfMonth,
    "f": formatUTCMicroseconds,
    "g": formatUTCYearISO,
    "G": formatUTCFullYearISO,
    "H": formatUTCHour24,
    "I": formatUTCHour12,
    "j": formatUTCDayOfYear,
    "L": formatUTCMilliseconds,
    "m": formatUTCMonthNumber,
    "M": formatUTCMinutes,
    "p": formatUTCPeriod,
    "q": formatUTCQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatUTCSeconds,
    "u": formatUTCWeekdayNumberMonday,
    "U": formatUTCWeekNumberSunday,
    "V": formatUTCWeekNumberISO,
    "w": formatUTCWeekdayNumberSunday,
    "W": formatUTCWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatUTCYear,
    "Y": formatUTCFullYear,
    "Z": formatUTCZone,
    "%": formatLiteralPercent
  };

  var parses = {
    "a": parseShortWeekday,
    "A": parseWeekday,
    "b": parseShortMonth,
    "B": parseMonth,
    "c": parseLocaleDateTime,
    "d": parseDayOfMonth,
    "e": parseDayOfMonth,
    "f": parseMicroseconds,
    "g": parseYear,
    "G": parseFullYear,
    "H": parseHour24,
    "I": parseHour24,
    "j": parseDayOfYear,
    "L": parseMilliseconds,
    "m": parseMonthNumber,
    "M": parseMinutes,
    "p": parsePeriod,
    "q": parseQuarter,
    "Q": parseUnixTimestamp,
    "s": parseUnixTimestampSeconds,
    "S": parseSeconds,
    "u": parseWeekdayNumberMonday,
    "U": parseWeekNumberSunday,
    "V": parseWeekNumberISO,
    "w": parseWeekdayNumberSunday,
    "W": parseWeekNumberMonday,
    "x": parseLocaleDate,
    "X": parseLocaleTime,
    "y": parseYear,
    "Y": parseFullYear,
    "Z": parseZone,
    "%": parseLiteralPercent
  };

  // These recursive directive definitions must be deferred.
  formats.x = newFormat(locale_date, formats);
  formats.X = newFormat(locale_time, formats);
  formats.c = newFormat(locale_dateTime, formats);
  utcFormats.x = newFormat(locale_date, utcFormats);
  utcFormats.X = newFormat(locale_time, utcFormats);
  utcFormats.c = newFormat(locale_dateTime, utcFormats);

  function newFormat(specifier, formats) {
    return function(date) {
      var string = [],
          i = -1,
          j = 0,
          n = specifier.length,
          c,
          pad,
          format;

      if (!(date instanceof Date)) date = new Date(+date);

      while (++i < n) {
        if (specifier.charCodeAt(i) === 37) {
          string.push(specifier.slice(j, i));
          if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
          else pad = c === "e" ? " " : "0";
          if (format = formats[c]) c = format(date, pad);
          string.push(c);
          j = i + 1;
        }
      }

      string.push(specifier.slice(j, i));
      return string.join("");
    };
  }

  function newParse(specifier, Z) {
    return function(string) {
      var d = newDate(1900, undefined, 1),
          i = parseSpecifier(d, specifier, string += "", 0),
          week, day;
      if (i != string.length) return null;

      // If a UNIX timestamp is specified, return it.
      if ("Q" in d) return new Date(d.Q);
      if ("s" in d) return new Date(d.s * 1000 + ("L" in d ? d.L : 0));

      // If this is utcParse, never use the local timezone.
      if (Z && !("Z" in d)) d.Z = 0;

      // The am-pm flag is 0 for AM, and 1 for PM.
      if ("p" in d) d.H = d.H % 12 + d.p * 12;

      // If the month was not specified, inherit from the quarter.
      if (d.m === undefined) d.m = "q" in d ? d.q : 0;

      // Convert day-of-week and week-of-year to day-of-year.
      if ("V" in d) {
        if (d.V < 1 || d.V > 53) return null;
        if (!("w" in d)) d.w = 1;
        if ("Z" in d) {
          week = utcDate(newDate(d.y, 0, 1)), day = week.getUTCDay();
          week = day > 4 || day === 0 ? utcMonday.ceil(week) : utcMonday(week);
          week = utcDay.offset(week, (d.V - 1) * 7);
          d.y = week.getUTCFullYear();
          d.m = week.getUTCMonth();
          d.d = week.getUTCDate() + (d.w + 6) % 7;
        } else {
          week = localDate(newDate(d.y, 0, 1)), day = week.getDay();
          week = day > 4 || day === 0 ? timeMonday.ceil(week) : timeMonday(week);
          week = timeDay.offset(week, (d.V - 1) * 7);
          d.y = week.getFullYear();
          d.m = week.getMonth();
          d.d = week.getDate() + (d.w + 6) % 7;
        }
      } else if ("W" in d || "U" in d) {
        if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
        day = "Z" in d ? utcDate(newDate(d.y, 0, 1)).getUTCDay() : localDate(newDate(d.y, 0, 1)).getDay();
        d.m = 0;
        d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
      }

      // If a time zone is specified, all fields are interpreted as UTC and then
      // offset according to the specified time zone.
      if ("Z" in d) {
        d.H += d.Z / 100 | 0;
        d.M += d.Z % 100;
        return utcDate(d);
      }

      // Otherwise, all fields are in local time.
      return localDate(d);
    };
  }

  function parseSpecifier(d, specifier, string, j) {
    var i = 0,
        n = specifier.length,
        m = string.length,
        c,
        parse;

    while (i < n) {
      if (j >= m) return -1;
      c = specifier.charCodeAt(i++);
      if (c === 37) {
        c = specifier.charAt(i++);
        parse = parses[c in pads ? specifier.charAt(i++) : c];
        if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
      } else if (c != string.charCodeAt(j++)) {
        return -1;
      }
    }

    return j;
  }

  function parsePeriod(d, string, i) {
    var n = periodRe.exec(string.slice(i));
    return n ? (d.p = periodLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }

  function parseShortWeekday(d, string, i) {
    var n = shortWeekdayRe.exec(string.slice(i));
    return n ? (d.w = shortWeekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }

  function parseWeekday(d, string, i) {
    var n = weekdayRe.exec(string.slice(i));
    return n ? (d.w = weekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }

  function parseShortMonth(d, string, i) {
    var n = shortMonthRe.exec(string.slice(i));
    return n ? (d.m = shortMonthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }

  function parseMonth(d, string, i) {
    var n = monthRe.exec(string.slice(i));
    return n ? (d.m = monthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }

  function parseLocaleDateTime(d, string, i) {
    return parseSpecifier(d, locale_dateTime, string, i);
  }

  function parseLocaleDate(d, string, i) {
    return parseSpecifier(d, locale_date, string, i);
  }

  function parseLocaleTime(d, string, i) {
    return parseSpecifier(d, locale_time, string, i);
  }

  function formatShortWeekday(d) {
    return locale_shortWeekdays[d.getDay()];
  }

  function formatWeekday(d) {
    return locale_weekdays[d.getDay()];
  }

  function formatShortMonth(d) {
    return locale_shortMonths[d.getMonth()];
  }

  function formatMonth(d) {
    return locale_months[d.getMonth()];
  }

  function formatPeriod(d) {
    return locale_periods[+(d.getHours() >= 12)];
  }

  function formatQuarter(d) {
    return 1 + ~~(d.getMonth() / 3);
  }

  function formatUTCShortWeekday(d) {
    return locale_shortWeekdays[d.getUTCDay()];
  }

  function formatUTCWeekday(d) {
    return locale_weekdays[d.getUTCDay()];
  }

  function formatUTCShortMonth(d) {
    return locale_shortMonths[d.getUTCMonth()];
  }

  function formatUTCMonth(d) {
    return locale_months[d.getUTCMonth()];
  }

  function formatUTCPeriod(d) {
    return locale_periods[+(d.getUTCHours() >= 12)];
  }

  function formatUTCQuarter(d) {
    return 1 + ~~(d.getUTCMonth() / 3);
  }

  return {
    format: function(specifier) {
      var f = newFormat(specifier += "", formats);
      f.toString = function() { return specifier; };
      return f;
    },
    parse: function(specifier) {
      var p = newParse(specifier += "", false);
      p.toString = function() { return specifier; };
      return p;
    },
    utcFormat: function(specifier) {
      var f = newFormat(specifier += "", utcFormats);
      f.toString = function() { return specifier; };
      return f;
    },
    utcParse: function(specifier) {
      var p = newParse(specifier += "", true);
      p.toString = function() { return specifier; };
      return p;
    }
  };
}

var pads = {"-": "", "_": " ", "0": "0"},
    numberRe = /^\s*\d+/, // note: ignores next directive
    percentRe = /^%/,
    requoteRe = /[\\^$*+?|[\]().{}]/g;

function pad(value, fill, width) {
  var sign = value < 0 ? "-" : "",
      string = (sign ? -value : value) + "",
      length = string.length;
  return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
}

function requote(s) {
  return s.replace(requoteRe, "\\$&");
}

function formatRe(names) {
  return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
}

function formatLookup(names) {
  return new Map(names.map((name, i) => [name.toLowerCase(), i]));
}

function parseWeekdayNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.w = +n[0], i + n[0].length) : -1;
}

function parseWeekdayNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.u = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.U = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberISO(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.V = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.W = +n[0], i + n[0].length) : -1;
}

function parseFullYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 4));
  return n ? (d.y = +n[0], i + n[0].length) : -1;
}

function parseYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
}

function parseZone(d, string, i) {
  var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
  return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
}

function parseQuarter(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.q = n[0] * 3 - 3, i + n[0].length) : -1;
}

function parseMonthNumber(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
}

function parseDayOfMonth(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.d = +n[0], i + n[0].length) : -1;
}

function parseDayOfYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
}

function parseHour24(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.H = +n[0], i + n[0].length) : -1;
}

function parseMinutes(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.M = +n[0], i + n[0].length) : -1;
}

function parseSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.S = +n[0], i + n[0].length) : -1;
}

function parseMilliseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.L = +n[0], i + n[0].length) : -1;
}

function parseMicroseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 6));
  return n ? (d.L = Math.floor(n[0] / 1000), i + n[0].length) : -1;
}

function parseLiteralPercent(d, string, i) {
  var n = percentRe.exec(string.slice(i, i + 1));
  return n ? i + n[0].length : -1;
}

function parseUnixTimestamp(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.Q = +n[0], i + n[0].length) : -1;
}

function parseUnixTimestampSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.s = +n[0], i + n[0].length) : -1;
}

function formatDayOfMonth(d, p) {
  return pad(d.getDate(), p, 2);
}

function formatHour24(d, p) {
  return pad(d.getHours(), p, 2);
}

function formatHour12(d, p) {
  return pad(d.getHours() % 12 || 12, p, 2);
}

function formatDayOfYear(d, p) {
  return pad(1 + timeDay.count(timeYear(d), d), p, 3);
}

function formatMilliseconds(d, p) {
  return pad(d.getMilliseconds(), p, 3);
}

function formatMicroseconds(d, p) {
  return formatMilliseconds(d, p) + "000";
}

function formatMonthNumber(d, p) {
  return pad(d.getMonth() + 1, p, 2);
}

function formatMinutes(d, p) {
  return pad(d.getMinutes(), p, 2);
}

function formatSeconds(d, p) {
  return pad(d.getSeconds(), p, 2);
}

function formatWeekdayNumberMonday(d) {
  var day = d.getDay();
  return day === 0 ? 7 : day;
}

function formatWeekNumberSunday(d, p) {
  return pad(timeSunday.count(timeYear(d) - 1, d), p, 2);
}

function dISO(d) {
  var day = d.getDay();
  return (day >= 4 || day === 0) ? timeThursday(d) : timeThursday.ceil(d);
}

function formatWeekNumberISO(d, p) {
  d = dISO(d);
  return pad(timeThursday.count(timeYear(d), d) + (timeYear(d).getDay() === 4), p, 2);
}

function formatWeekdayNumberSunday(d) {
  return d.getDay();
}

function formatWeekNumberMonday(d, p) {
  return pad(timeMonday.count(timeYear(d) - 1, d), p, 2);
}

function formatYear(d, p) {
  return pad(d.getFullYear() % 100, p, 2);
}

function formatYearISO(d, p) {
  d = dISO(d);
  return pad(d.getFullYear() % 100, p, 2);
}

function formatFullYear(d, p) {
  return pad(d.getFullYear() % 10000, p, 4);
}

function formatFullYearISO(d, p) {
  var day = d.getDay();
  d = (day >= 4 || day === 0) ? timeThursday(d) : timeThursday.ceil(d);
  return pad(d.getFullYear() % 10000, p, 4);
}

function formatZone(d) {
  var z = d.getTimezoneOffset();
  return (z > 0 ? "-" : (z *= -1, "+"))
      + pad(z / 60 | 0, "0", 2)
      + pad(z % 60, "0", 2);
}

function formatUTCDayOfMonth(d, p) {
  return pad(d.getUTCDate(), p, 2);
}

function formatUTCHour24(d, p) {
  return pad(d.getUTCHours(), p, 2);
}

function formatUTCHour12(d, p) {
  return pad(d.getUTCHours() % 12 || 12, p, 2);
}

function formatUTCDayOfYear(d, p) {
  return pad(1 + utcDay.count(utcYear(d), d), p, 3);
}

function formatUTCMilliseconds(d, p) {
  return pad(d.getUTCMilliseconds(), p, 3);
}

function formatUTCMicroseconds(d, p) {
  return formatUTCMilliseconds(d, p) + "000";
}

function formatUTCMonthNumber(d, p) {
  return pad(d.getUTCMonth() + 1, p, 2);
}

function formatUTCMinutes(d, p) {
  return pad(d.getUTCMinutes(), p, 2);
}

function formatUTCSeconds(d, p) {
  return pad(d.getUTCSeconds(), p, 2);
}

function formatUTCWeekdayNumberMonday(d) {
  var dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

function formatUTCWeekNumberSunday(d, p) {
  return pad(utcSunday.count(utcYear(d) - 1, d), p, 2);
}

function UTCdISO(d) {
  var day = d.getUTCDay();
  return (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
}

function formatUTCWeekNumberISO(d, p) {
  d = UTCdISO(d);
  return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
}

function formatUTCWeekdayNumberSunday(d) {
  return d.getUTCDay();
}

function formatUTCWeekNumberMonday(d, p) {
  return pad(utcMonday.count(utcYear(d) - 1, d), p, 2);
}

function formatUTCYear(d, p) {
  return pad(d.getUTCFullYear() % 100, p, 2);
}

function formatUTCYearISO(d, p) {
  d = UTCdISO(d);
  return pad(d.getUTCFullYear() % 100, p, 2);
}

function formatUTCFullYear(d, p) {
  return pad(d.getUTCFullYear() % 10000, p, 4);
}

function formatUTCFullYearISO(d, p) {
  var day = d.getUTCDay();
  d = (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
  return pad(d.getUTCFullYear() % 10000, p, 4);
}

function formatUTCZone() {
  return "+0000";
}

function formatLiteralPercent() {
  return "%";
}

function formatUnixTimestamp(d) {
  return +d;
}

function formatUnixTimestampSeconds(d) {
  return Math.floor(+d / 1000);
}

var locale;
var timeFormat;

defaultLocale({
  dateTime: "%x, %X",
  date: "%-m/%-d/%Y",
  time: "%-I:%M:%S %p",
  periods: ["AM", "PM"],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
});

function defaultLocale(definition) {
  locale = formatLocale(definition);
  timeFormat = locale.format;
  locale.parse;
  locale.utcFormat;
  locale.utcParse;
  return locale;
}

function date(t) {
  return new Date(t);
}

function number(t) {
  return t instanceof Date ? +t : +new Date(+t);
}

function calendar(ticks, tickInterval, year, month, week, day, hour, minute, second, format) {
  var scale = continuous(),
      invert = scale.invert,
      domain = scale.domain;

  var formatMillisecond = format(".%L"),
      formatSecond = format(":%S"),
      formatMinute = format("%I:%M"),
      formatHour = format("%I %p"),
      formatDay = format("%a %d"),
      formatWeek = format("%b %d"),
      formatMonth = format("%B"),
      formatYear = format("%Y");

  function tickFormat(date) {
    return (second(date) < date ? formatMillisecond
        : minute(date) < date ? formatSecond
        : hour(date) < date ? formatMinute
        : day(date) < date ? formatHour
        : month(date) < date ? (week(date) < date ? formatDay : formatWeek)
        : year(date) < date ? formatMonth
        : formatYear)(date);
  }

  scale.invert = function(y) {
    return new Date(invert(y));
  };

  scale.domain = function(_) {
    return arguments.length ? domain(Array.from(_, number)) : domain().map(date);
  };

  scale.ticks = function(interval) {
    var d = domain();
    return ticks(d[0], d[d.length - 1], interval == null ? 10 : interval);
  };

  scale.tickFormat = function(count, specifier) {
    return specifier == null ? tickFormat : format(specifier);
  };

  scale.nice = function(interval) {
    var d = domain();
    if (!interval || typeof interval.range !== "function") interval = tickInterval(d[0], d[d.length - 1], interval == null ? 10 : interval);
    return interval ? domain(nice(d, interval)) : scale;
  };

  scale.copy = function() {
    return copy(scale, calendar(ticks, tickInterval, year, month, week, day, hour, minute, second, format));
  };

  return scale;
}

function time() {
  return initRange.apply(calendar(timeTicks, timeTickInterval, timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute, second, timeFormat).domain([new Date(2000, 0, 1), new Date(2000, 0, 2)]), arguments);
}

var isoWeek = {exports: {}};

(function (module, exports) {
	!function(e,t){module.exports=t();}(commonjsGlobal,(function(){var e="day";return function(t,i,s){var a=function(t){return t.add(4-t.isoWeekday(),e)},d=i.prototype;d.isoWeekYear=function(){return a(this).year()},d.isoWeek=function(t){if(!this.$utils().u(t))return this.add(7*(t-this.isoWeek()),e);var i,d,n,o,r=a(this),u=(i=this.isoWeekYear(),d=this.$u,n=(d?s.utc:s)().year(i).startOf("year"),o=4-n.isoWeekday(),n.isoWeekday()>4&&(o+=7),n.add(o,e));return r.diff(u,"week")+1},d.isoWeekday=function(e){return this.$utils().u(e)?this.day()||7:this.day(this.day()%7?e:e-7)};var n=d.startOf;d.startOf=function(e,t){var i=this.$utils(),s=!!i.u(t)||t;return "isoweek"===i.p(e)?s?this.date(this.date()-(this.isoWeekday()-1)).startOf("day"):this.date(this.date()-1-(this.isoWeekday()-1)+7).endOf("day"):n.bind(this)(e,t)};}})); 
} (isoWeek));

var isoWeekExports = isoWeek.exports;
const dayjsIsoWeek = /*@__PURE__*/getDefaultExportFromCjs(isoWeekExports);

var customParseFormat = {exports: {}};

(function (module, exports) {
	!function(e,t){module.exports=t();}(commonjsGlobal,(function(){var e={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},t=/(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g,n=/\d/,r=/\d\d/,i=/\d\d?/,o=/\d*[^-_:/,()\s\d]+/,s={},a=function(e){return (e=+e)+(e>68?1900:2e3)};var f=function(e){return function(t){this[e]=+t;}},h=[/[+-]\d\d:?(\d\d)?|Z/,function(e){(this.zone||(this.zone={})).offset=function(e){if(!e)return 0;if("Z"===e)return 0;var t=e.match(/([+-]|\d\d)/g),n=60*t[1]+(+t[2]||0);return 0===n?0:"+"===t[0]?-n:n}(e);}],u=function(e){var t=s[e];return t&&(t.indexOf?t:t.s.concat(t.f))},d=function(e,t){var n,r=s.meridiem;if(r){for(var i=1;i<=24;i+=1)if(e.indexOf(r(i,0,t))>-1){n=i>12;break}}else n=e===(t?"pm":"PM");return n},c={A:[o,function(e){this.afternoon=d(e,!1);}],a:[o,function(e){this.afternoon=d(e,!0);}],Q:[n,function(e){this.month=3*(e-1)+1;}],S:[n,function(e){this.milliseconds=100*+e;}],SS:[r,function(e){this.milliseconds=10*+e;}],SSS:[/\d{3}/,function(e){this.milliseconds=+e;}],s:[i,f("seconds")],ss:[i,f("seconds")],m:[i,f("minutes")],mm:[i,f("minutes")],H:[i,f("hours")],h:[i,f("hours")],HH:[i,f("hours")],hh:[i,f("hours")],D:[i,f("day")],DD:[r,f("day")],Do:[o,function(e){var t=s.ordinal,n=e.match(/\d+/);if(this.day=n[0],t)for(var r=1;r<=31;r+=1)t(r).replace(/\[|\]/g,"")===e&&(this.day=r);}],w:[i,f("week")],ww:[r,f("week")],M:[i,f("month")],MM:[r,f("month")],MMM:[o,function(e){var t=u("months"),n=(u("monthsShort")||t.map((function(e){return e.slice(0,3)}))).indexOf(e)+1;if(n<1)throw new Error;this.month=n%12||n;}],MMMM:[o,function(e){var t=u("months").indexOf(e)+1;if(t<1)throw new Error;this.month=t%12||t;}],Y:[/[+-]?\d+/,f("year")],YY:[r,function(e){this.year=a(e);}],YYYY:[/\d{4}/,f("year")],Z:h,ZZ:h};function l(n){var r,i;r=n,i=s&&s.formats;for(var o=(n=r.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,(function(t,n,r){var o=r&&r.toUpperCase();return n||i[r]||e[r]||i[o].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g,(function(e,t,n){return t||n.slice(1)}))}))).match(t),a=o.length,f=0;f<a;f+=1){var h=o[f],u=c[h],d=u&&u[0],l=u&&u[1];o[f]=l?{regex:d,parser:l}:h.replace(/^\[|\]$/g,"");}return function(e){for(var t={},n=0,r=0;n<a;n+=1){var i=o[n];if("string"==typeof i)r+=i.length;else {var s=i.regex,f=i.parser,h=e.slice(r),u=s.exec(h)[0];f.call(t,u),e=e.replace(u,"");}}return function(e){var t=e.afternoon;if(void 0!==t){var n=e.hours;t?n<12&&(e.hours+=12):12===n&&(e.hours=0),delete e.afternoon;}}(t),t}}return function(e,t,n){n.p.customParseFormat=!0,e&&e.parseTwoDigitYear&&(a=e.parseTwoDigitYear);var r=t.prototype,i=r.parse;r.parse=function(e){var t=e.date,r=e.utc,o=e.args;this.$u=r;var a=o[1];if("string"==typeof a){var f=!0===o[2],h=!0===o[3],u=f||h,d=o[2];h&&(d=o[2]),s=this.$locale(),!f&&d&&(s=n.Ls[d]),this.$d=function(e,t,n,r){try{if(["x","X"].indexOf(t)>-1)return new Date(("X"===t?1e3:1)*e);var i=l(t)(e),o=i.year,s=i.month,a=i.day,f=i.hours,h=i.minutes,u=i.seconds,d=i.milliseconds,c=i.zone,m=i.week,M=new Date,Y=a||(o||s?1:M.getDate()),p=o||M.getFullYear(),v=0;o&&!s||(v=s>0?s-1:M.getMonth());var D,w=f||0,g=h||0,y=u||0,L=d||0;return c?new Date(Date.UTC(p,v,Y,w,g,y,L+60*c.offset*1e3)):n?new Date(Date.UTC(p,v,Y,w,g,y,L)):(D=new Date(p,v,Y,w,g,y,L),m&&(D=r(D).week(m).toDate()),D)}catch(e){return new Date("")}}(t,a,r,n),this.init(),d&&!0!==d&&(this.$L=this.locale(d).$L),u&&t!=this.format(a)&&(this.$d=new Date("")),s={};}else if(a instanceof Array)for(var c=a.length,m=1;m<=c;m+=1){o[1]=a[m-1];var M=n.apply(this,o);if(M.isValid()){this.$d=M.$d,this.$L=M.$L,this.init();break}m===c&&(this.$d=new Date(""));}else i.call(this,e);};}})); 
} (customParseFormat));

var customParseFormatExports = customParseFormat.exports;
const dayjsCustomParseFormat = /*@__PURE__*/getDefaultExportFromCjs(customParseFormatExports);

var advancedFormat = {exports: {}};

(function (module, exports) {
	!function(e,t){module.exports=t();}(commonjsGlobal,(function(){return function(e,t){var r=t.prototype,n=r.format;r.format=function(e){var t=this,r=this.$locale();if(!this.isValid())return n.bind(this)(e);var s=this.$utils(),a=(e||"YYYY-MM-DDTHH:mm:ssZ").replace(/\[([^\]]+)]|Q|wo|ww|w|WW|W|zzz|z|gggg|GGGG|Do|X|x|k{1,2}|S/g,(function(e){switch(e){case"Q":return Math.ceil((t.$M+1)/3);case"Do":return r.ordinal(t.$D);case"gggg":return t.weekYear();case"GGGG":return t.isoWeekYear();case"wo":return r.ordinal(t.week(),"W");case"w":case"ww":return s.s(t.week(),"w"===e?1:2,"0");case"W":case"WW":return s.s(t.isoWeek(),"W"===e?1:2,"0");case"k":case"kk":return s.s(String(0===t.$H?24:t.$H),"k"===e?1:2,"0");case"X":return Math.floor(t.$d.getTime()/1e3);case"x":return t.$d.getTime();case"z":return "["+t.offsetName()+"]";case"zzz":return "["+t.offsetName("long")+"]";default:return e}}));return n.bind(this)(a)};}})); 
} (advancedFormat));

var advancedFormatExports = advancedFormat.exports;
const dayjsAdvancedFormat = /*@__PURE__*/getDefaultExportFromCjs(advancedFormatExports);

// src/diagrams/gantt/parser/gantt.jison
var parser = function() {
  var o = /* @__PURE__ */ __name(function(k, v, o2, l) {
    for (o2 = o2 || {}, l = k.length; l--; o2[k[l]] = v) ;
    return o2;
  }, "o"), $V0 = [6, 8, 10, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 35, 36, 38, 40], $V1 = [1, 26], $V2 = [1, 27], $V3 = [1, 28], $V4 = [1, 29], $V5 = [1, 30], $V6 = [1, 31], $V7 = [1, 32], $V8 = [1, 33], $V9 = [1, 34], $Va = [1, 9], $Vb = [1, 10], $Vc = [1, 11], $Vd = [1, 12], $Ve = [1, 13], $Vf = [1, 14], $Vg = [1, 15], $Vh = [1, 16], $Vi = [1, 19], $Vj = [1, 20], $Vk = [1, 21], $Vl = [1, 22], $Vm = [1, 23], $Vn = [1, 25], $Vo = [1, 35];
  var parser2 = {
    trace: /* @__PURE__ */ __name(function trace() {
    }, "trace"),
    yy: {},
    symbols_: { "error": 2, "start": 3, "gantt": 4, "document": 5, "EOF": 6, "line": 7, "SPACE": 8, "statement": 9, "NL": 10, "weekday": 11, "weekday_monday": 12, "weekday_tuesday": 13, "weekday_wednesday": 14, "weekday_thursday": 15, "weekday_friday": 16, "weekday_saturday": 17, "weekday_sunday": 18, "weekend": 19, "weekend_friday": 20, "weekend_saturday": 21, "dateFormat": 22, "inclusiveEndDates": 23, "topAxis": 24, "axisFormat": 25, "tickInterval": 26, "excludes": 27, "includes": 28, "todayMarker": 29, "title": 30, "acc_title": 31, "acc_title_value": 32, "acc_descr": 33, "acc_descr_value": 34, "acc_descr_multiline_value": 35, "section": 36, "clickStatement": 37, "taskTxt": 38, "taskData": 39, "click": 40, "callbackname": 41, "callbackargs": 42, "href": 43, "clickStatementDebug": 44, "$accept": 0, "$end": 1 },
    terminals_: { 2: "error", 4: "gantt", 6: "EOF", 8: "SPACE", 10: "NL", 12: "weekday_monday", 13: "weekday_tuesday", 14: "weekday_wednesday", 15: "weekday_thursday", 16: "weekday_friday", 17: "weekday_saturday", 18: "weekday_sunday", 20: "weekend_friday", 21: "weekend_saturday", 22: "dateFormat", 23: "inclusiveEndDates", 24: "topAxis", 25: "axisFormat", 26: "tickInterval", 27: "excludes", 28: "includes", 29: "todayMarker", 30: "title", 31: "acc_title", 32: "acc_title_value", 33: "acc_descr", 34: "acc_descr_value", 35: "acc_descr_multiline_value", 36: "section", 38: "taskTxt", 39: "taskData", 40: "click", 41: "callbackname", 42: "callbackargs", 43: "href" },
    productions_: [0, [3, 3], [5, 0], [5, 2], [7, 2], [7, 1], [7, 1], [7, 1], [11, 1], [11, 1], [11, 1], [11, 1], [11, 1], [11, 1], [11, 1], [19, 1], [19, 1], [9, 1], [9, 1], [9, 1], [9, 1], [9, 1], [9, 1], [9, 1], [9, 1], [9, 1], [9, 1], [9, 1], [9, 2], [9, 2], [9, 1], [9, 1], [9, 1], [9, 2], [37, 2], [37, 3], [37, 3], [37, 4], [37, 3], [37, 4], [37, 2], [44, 2], [44, 3], [44, 3], [44, 4], [44, 3], [44, 4], [44, 2]],
    performAction: /* @__PURE__ */ __name(function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$) {
      var $0 = $$.length - 1;
      switch (yystate) {
        case 1:
          return $$[$0 - 1];
        case 2:
          this.$ = [];
          break;
        case 3:
          $$[$0 - 1].push($$[$0]);
          this.$ = $$[$0 - 1];
          break;
        case 4:
        case 5:
          this.$ = $$[$0];
          break;
        case 6:
        case 7:
          this.$ = [];
          break;
        case 8:
          yy.setWeekday("monday");
          break;
        case 9:
          yy.setWeekday("tuesday");
          break;
        case 10:
          yy.setWeekday("wednesday");
          break;
        case 11:
          yy.setWeekday("thursday");
          break;
        case 12:
          yy.setWeekday("friday");
          break;
        case 13:
          yy.setWeekday("saturday");
          break;
        case 14:
          yy.setWeekday("sunday");
          break;
        case 15:
          yy.setWeekend("friday");
          break;
        case 16:
          yy.setWeekend("saturday");
          break;
        case 17:
          yy.setDateFormat($$[$0].substr(11));
          this.$ = $$[$0].substr(11);
          break;
        case 18:
          yy.enableInclusiveEndDates();
          this.$ = $$[$0].substr(18);
          break;
        case 19:
          yy.TopAxis();
          this.$ = $$[$0].substr(8);
          break;
        case 20:
          yy.setAxisFormat($$[$0].substr(11));
          this.$ = $$[$0].substr(11);
          break;
        case 21:
          yy.setTickInterval($$[$0].substr(13));
          this.$ = $$[$0].substr(13);
          break;
        case 22:
          yy.setExcludes($$[$0].substr(9));
          this.$ = $$[$0].substr(9);
          break;
        case 23:
          yy.setIncludes($$[$0].substr(9));
          this.$ = $$[$0].substr(9);
          break;
        case 24:
          yy.setTodayMarker($$[$0].substr(12));
          this.$ = $$[$0].substr(12);
          break;
        case 27:
          yy.setDiagramTitle($$[$0].substr(6));
          this.$ = $$[$0].substr(6);
          break;
        case 28:
          this.$ = $$[$0].trim();
          yy.setAccTitle(this.$);
          break;
        case 29:
        case 30:
          this.$ = $$[$0].trim();
          yy.setAccDescription(this.$);
          break;
        case 31:
          yy.addSection($$[$0].substr(8));
          this.$ = $$[$0].substr(8);
          break;
        case 33:
          yy.addTask($$[$0 - 1], $$[$0]);
          this.$ = "task";
          break;
        case 34:
          this.$ = $$[$0 - 1];
          yy.setClickEvent($$[$0 - 1], $$[$0], null);
          break;
        case 35:
          this.$ = $$[$0 - 2];
          yy.setClickEvent($$[$0 - 2], $$[$0 - 1], $$[$0]);
          break;
        case 36:
          this.$ = $$[$0 - 2];
          yy.setClickEvent($$[$0 - 2], $$[$0 - 1], null);
          yy.setLink($$[$0 - 2], $$[$0]);
          break;
        case 37:
          this.$ = $$[$0 - 3];
          yy.setClickEvent($$[$0 - 3], $$[$0 - 2], $$[$0 - 1]);
          yy.setLink($$[$0 - 3], $$[$0]);
          break;
        case 38:
          this.$ = $$[$0 - 2];
          yy.setClickEvent($$[$0 - 2], $$[$0], null);
          yy.setLink($$[$0 - 2], $$[$0 - 1]);
          break;
        case 39:
          this.$ = $$[$0 - 3];
          yy.setClickEvent($$[$0 - 3], $$[$0 - 1], $$[$0]);
          yy.setLink($$[$0 - 3], $$[$0 - 2]);
          break;
        case 40:
          this.$ = $$[$0 - 1];
          yy.setLink($$[$0 - 1], $$[$0]);
          break;
        case 41:
        case 47:
          this.$ = $$[$0 - 1] + " " + $$[$0];
          break;
        case 42:
        case 43:
        case 45:
          this.$ = $$[$0 - 2] + " " + $$[$0 - 1] + " " + $$[$0];
          break;
        case 44:
        case 46:
          this.$ = $$[$0 - 3] + " " + $$[$0 - 2] + " " + $$[$0 - 1] + " " + $$[$0];
          break;
      }
    }, "anonymous"),
    table: [{ 3: 1, 4: [1, 2] }, { 1: [3] }, o($V0, [2, 2], { 5: 3 }), { 6: [1, 4], 7: 5, 8: [1, 6], 9: 7, 10: [1, 8], 11: 17, 12: $V1, 13: $V2, 14: $V3, 15: $V4, 16: $V5, 17: $V6, 18: $V7, 19: 18, 20: $V8, 21: $V9, 22: $Va, 23: $Vb, 24: $Vc, 25: $Vd, 26: $Ve, 27: $Vf, 28: $Vg, 29: $Vh, 30: $Vi, 31: $Vj, 33: $Vk, 35: $Vl, 36: $Vm, 37: 24, 38: $Vn, 40: $Vo }, o($V0, [2, 7], { 1: [2, 1] }), o($V0, [2, 3]), { 9: 36, 11: 17, 12: $V1, 13: $V2, 14: $V3, 15: $V4, 16: $V5, 17: $V6, 18: $V7, 19: 18, 20: $V8, 21: $V9, 22: $Va, 23: $Vb, 24: $Vc, 25: $Vd, 26: $Ve, 27: $Vf, 28: $Vg, 29: $Vh, 30: $Vi, 31: $Vj, 33: $Vk, 35: $Vl, 36: $Vm, 37: 24, 38: $Vn, 40: $Vo }, o($V0, [2, 5]), o($V0, [2, 6]), o($V0, [2, 17]), o($V0, [2, 18]), o($V0, [2, 19]), o($V0, [2, 20]), o($V0, [2, 21]), o($V0, [2, 22]), o($V0, [2, 23]), o($V0, [2, 24]), o($V0, [2, 25]), o($V0, [2, 26]), o($V0, [2, 27]), { 32: [1, 37] }, { 34: [1, 38] }, o($V0, [2, 30]), o($V0, [2, 31]), o($V0, [2, 32]), { 39: [1, 39] }, o($V0, [2, 8]), o($V0, [2, 9]), o($V0, [2, 10]), o($V0, [2, 11]), o($V0, [2, 12]), o($V0, [2, 13]), o($V0, [2, 14]), o($V0, [2, 15]), o($V0, [2, 16]), { 41: [1, 40], 43: [1, 41] }, o($V0, [2, 4]), o($V0, [2, 28]), o($V0, [2, 29]), o($V0, [2, 33]), o($V0, [2, 34], { 42: [1, 42], 43: [1, 43] }), o($V0, [2, 40], { 41: [1, 44] }), o($V0, [2, 35], { 43: [1, 45] }), o($V0, [2, 36]), o($V0, [2, 38], { 42: [1, 46] }), o($V0, [2, 37]), o($V0, [2, 39])],
    defaultActions: {},
    parseError: /* @__PURE__ */ __name(function parseError(str, hash) {
      if (hash.recoverable) {
        this.trace(str);
      } else {
        var error = new Error(str);
        error.hash = hash;
        throw error;
      }
    }, "parseError"),
    parse: /* @__PURE__ */ __name(function parse(input) {
      var self = this, stack = [0], tstack = [], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, TERROR = 2, EOF = 1;
      var args = lstack.slice.call(arguments, 1);
      var lexer2 = Object.create(this.lexer);
      var sharedState = { yy: {} };
      for (var k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
          sharedState.yy[k] = this.yy[k];
        }
      }
      lexer2.setInput(input, sharedState.yy);
      sharedState.yy.lexer = lexer2;
      sharedState.yy.parser = this;
      if (typeof lexer2.yylloc == "undefined") {
        lexer2.yylloc = {};
      }
      var yyloc = lexer2.yylloc;
      lstack.push(yyloc);
      var ranges = lexer2.options && lexer2.options.ranges;
      if (typeof sharedState.yy.parseError === "function") {
        this.parseError = sharedState.yy.parseError;
      } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
      }
      function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
      }
      __name(popStack, "popStack");
      function lex() {
        var token;
        token = tstack.pop() || lexer2.lex() || EOF;
        if (typeof token !== "number") {
          if (token instanceof Array) {
            tstack = token;
            token = tstack.pop();
          }
          token = self.symbols_[token] || token;
        }
        return token;
      }
      __name(lex, "lex");
      var symbol, state, action, r, yyval = {}, p, len, newState, expected;
      while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
          action = this.defaultActions[state];
        } else {
          if (symbol === null || typeof symbol == "undefined") {
            symbol = lex();
          }
          action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
          var errStr = "";
          expected = [];
          for (p in table[state]) {
            if (this.terminals_[p] && p > TERROR) {
              expected.push("'" + this.terminals_[p] + "'");
            }
          }
          if (lexer2.showPosition) {
            errStr = "Parse error on line " + (yylineno + 1) + ":\n" + lexer2.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
          } else {
            errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == EOF ? "end of input" : "'" + (this.terminals_[symbol] || symbol) + "'");
          }
          this.parseError(errStr, {
            text: lexer2.match,
            token: this.terminals_[symbol] || symbol,
            line: lexer2.yylineno,
            loc: yyloc,
            expected
          });
        }
        if (action[0] instanceof Array && action.length > 1) {
          throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
          case 1:
            stack.push(symbol);
            vstack.push(lexer2.yytext);
            lstack.push(lexer2.yylloc);
            stack.push(action[1]);
            symbol = null;
            {
              yyleng = lexer2.yyleng;
              yytext = lexer2.yytext;
              yylineno = lexer2.yylineno;
              yyloc = lexer2.yylloc;
            }
            break;
          case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
              first_line: lstack[lstack.length - (len || 1)].first_line,
              last_line: lstack[lstack.length - 1].last_line,
              first_column: lstack[lstack.length - (len || 1)].first_column,
              last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
              yyval._$.range = [
                lstack[lstack.length - (len || 1)].range[0],
                lstack[lstack.length - 1].range[1]
              ];
            }
            r = this.performAction.apply(yyval, [
              yytext,
              yyleng,
              yylineno,
              sharedState.yy,
              action[1],
              vstack,
              lstack
            ].concat(args));
            if (typeof r !== "undefined") {
              return r;
            }
            if (len) {
              stack = stack.slice(0, -1 * len * 2);
              vstack = vstack.slice(0, -1 * len);
              lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
          case 3:
            return true;
        }
      }
      return true;
    }, "parse")
  };
  var lexer = /* @__PURE__ */ function() {
    var lexer2 = {
      EOF: 1,
      parseError: /* @__PURE__ */ __name(function parseError(str, hash) {
        if (this.yy.parser) {
          this.yy.parser.parseError(str, hash);
        } else {
          throw new Error(str);
        }
      }, "parseError"),
      // resets the lexer, sets new input
      setInput: /* @__PURE__ */ __name(function(input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = "";
        this.conditionStack = ["INITIAL"];
        this.yylloc = {
          first_line: 1,
          first_column: 0,
          last_line: 1,
          last_column: 0
        };
        if (this.options.ranges) {
          this.yylloc.range = [0, 0];
        }
        this.offset = 0;
        return this;
      }, "setInput"),
      // consumes and returns one char from the input
      input: /* @__PURE__ */ __name(function() {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
          this.yylineno++;
          this.yylloc.last_line++;
        } else {
          this.yylloc.last_column++;
        }
        if (this.options.ranges) {
          this.yylloc.range[1]++;
        }
        this._input = this._input.slice(1);
        return ch;
      }, "input"),
      // unshifts one char (or a string) into the input
      unput: /* @__PURE__ */ __name(function(ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);
        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);
        if (lines.length - 1) {
          this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;
        this.yylloc = {
          first_line: this.yylloc.first_line,
          last_line: this.yylineno + 1,
          first_column: this.yylloc.first_column,
          last_column: lines ? (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length : this.yylloc.first_column - len
        };
        if (this.options.ranges) {
          this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
      }, "unput"),
      // When called from action, caches matched text and appends it on next action
      more: /* @__PURE__ */ __name(function() {
        this._more = true;
        return this;
      }, "more"),
      // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
      reject: /* @__PURE__ */ __name(function() {
        if (this.options.backtrack_lexer) {
          this._backtrack = true;
        } else {
          return this.parseError("Lexical error on line " + (this.yylineno + 1) + ". You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n" + this.showPosition(), {
            text: "",
            token: null,
            line: this.yylineno
          });
        }
        return this;
      }, "reject"),
      // retain first n characters of the match
      less: /* @__PURE__ */ __name(function(n) {
        this.unput(this.match.slice(n));
      }, "less"),
      // displays already matched input, i.e. for error messages
      pastInput: /* @__PURE__ */ __name(function() {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? "..." : "") + past.substr(-20).replace(/\n/g, "");
      }, "pastInput"),
      // displays upcoming input, i.e. for error messages
      upcomingInput: /* @__PURE__ */ __name(function() {
        var next = this.match;
        if (next.length < 20) {
          next += this._input.substr(0, 20 - next.length);
        }
        return (next.substr(0, 20) + (next.length > 20 ? "..." : "")).replace(/\n/g, "");
      }, "upcomingInput"),
      // displays the character position where the lexing error occurred, i.e. for error messages
      showPosition: /* @__PURE__ */ __name(function() {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
      }, "showPosition"),
      // test the lexed token: return FALSE when not a match, otherwise return token
      test_match: /* @__PURE__ */ __name(function(match, indexed_rule) {
        var token, lines, backup;
        if (this.options.backtrack_lexer) {
          backup = {
            yylineno: this.yylineno,
            yylloc: {
              first_line: this.yylloc.first_line,
              last_line: this.last_line,
              first_column: this.yylloc.first_column,
              last_column: this.yylloc.last_column
            },
            yytext: this.yytext,
            match: this.match,
            matches: this.matches,
            matched: this.matched,
            yyleng: this.yyleng,
            offset: this.offset,
            _more: this._more,
            _input: this._input,
            yy: this.yy,
            conditionStack: this.conditionStack.slice(0),
            done: this.done
          };
          if (this.options.ranges) {
            backup.yylloc.range = this.yylloc.range.slice(0);
          }
        }
        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
          this.yylineno += lines.length;
        }
        this.yylloc = {
          first_line: this.yylloc.last_line,
          last_line: this.yylineno + 1,
          first_column: this.yylloc.last_column,
          last_column: lines ? lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
          this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
          this.done = false;
        }
        if (token) {
          return token;
        } else if (this._backtrack) {
          for (var k in backup) {
            this[k] = backup[k];
          }
          return false;
        }
        return false;
      }, "test_match"),
      // return next match in input
      next: /* @__PURE__ */ __name(function() {
        if (this.done) {
          return this.EOF;
        }
        if (!this._input) {
          this.done = true;
        }
        var token, match, tempMatch, index;
        if (!this._more) {
          this.yytext = "";
          this.match = "";
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
          tempMatch = this._input.match(this.rules[rules[i]]);
          if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
            match = tempMatch;
            index = i;
            if (this.options.backtrack_lexer) {
              token = this.test_match(tempMatch, rules[i]);
              if (token !== false) {
                return token;
              } else if (this._backtrack) {
                match = false;
                continue;
              } else {
                return false;
              }
            } else if (!this.options.flex) {
              break;
            }
          }
        }
        if (match) {
          token = this.test_match(match, rules[index]);
          if (token !== false) {
            return token;
          }
          return false;
        }
        if (this._input === "") {
          return this.EOF;
        } else {
          return this.parseError("Lexical error on line " + (this.yylineno + 1) + ". Unrecognized text.\n" + this.showPosition(), {
            text: "",
            token: null,
            line: this.yylineno
          });
        }
      }, "next"),
      // return next match that has a token
      lex: /* @__PURE__ */ __name(function lex() {
        var r = this.next();
        if (r) {
          return r;
        } else {
          return this.lex();
        }
      }, "lex"),
      // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
      begin: /* @__PURE__ */ __name(function begin(condition) {
        this.conditionStack.push(condition);
      }, "begin"),
      // pop the previously active lexer condition state off the condition stack
      popState: /* @__PURE__ */ __name(function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
          return this.conditionStack.pop();
        } else {
          return this.conditionStack[0];
        }
      }, "popState"),
      // produce the lexer rule set which is active for the currently active lexer condition state
      _currentRules: /* @__PURE__ */ __name(function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
          return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
          return this.conditions["INITIAL"].rules;
        }
      }, "_currentRules"),
      // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
      topState: /* @__PURE__ */ __name(function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
          return this.conditionStack[n];
        } else {
          return "INITIAL";
        }
      }, "topState"),
      // alias for begin(condition)
      pushState: /* @__PURE__ */ __name(function pushState(condition) {
        this.begin(condition);
      }, "pushState"),
      // return the number of states currently on the stack
      stateStackSize: /* @__PURE__ */ __name(function stateStackSize() {
        return this.conditionStack.length;
      }, "stateStackSize"),
      options: { "case-insensitive": true },
      performAction: /* @__PURE__ */ __name(function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {
        switch ($avoiding_name_collisions) {
          case 0:
            this.begin("open_directive");
            return "open_directive";
          case 1:
            this.begin("acc_title");
            return 31;
          case 2:
            this.popState();
            return "acc_title_value";
          case 3:
            this.begin("acc_descr");
            return 33;
          case 4:
            this.popState();
            return "acc_descr_value";
          case 5:
            this.begin("acc_descr_multiline");
            break;
          case 6:
            this.popState();
            break;
          case 7:
            return "acc_descr_multiline_value";
          case 8:
            break;
          case 9:
            break;
          case 10:
            break;
          case 11:
            return 10;
          case 12:
            break;
          case 13:
            break;
          case 14:
            this.begin("href");
            break;
          case 15:
            this.popState();
            break;
          case 16:
            return 43;
          case 17:
            this.begin("callbackname");
            break;
          case 18:
            this.popState();
            break;
          case 19:
            this.popState();
            this.begin("callbackargs");
            break;
          case 20:
            return 41;
          case 21:
            this.popState();
            break;
          case 22:
            return 42;
          case 23:
            this.begin("click");
            break;
          case 24:
            this.popState();
            break;
          case 25:
            return 40;
          case 26:
            return 4;
          case 27:
            return 22;
          case 28:
            return 23;
          case 29:
            return 24;
          case 30:
            return 25;
          case 31:
            return 26;
          case 32:
            return 28;
          case 33:
            return 27;
          case 34:
            return 29;
          case 35:
            return 12;
          case 36:
            return 13;
          case 37:
            return 14;
          case 38:
            return 15;
          case 39:
            return 16;
          case 40:
            return 17;
          case 41:
            return 18;
          case 42:
            return 20;
          case 43:
            return 21;
          case 44:
            return "date";
          case 45:
            return 30;
          case 46:
            return "accDescription";
          case 47:
            return 36;
          case 48:
            return 38;
          case 49:
            return 39;
          case 50:
            return ":";
          case 51:
            return 6;
          case 52:
            return "INVALID";
        }
      }, "anonymous"),
      rules: [/^(?:%%\{)/i, /^(?:accTitle\s*:\s*)/i, /^(?:(?!\n||)*[^\n]*)/i, /^(?:accDescr\s*:\s*)/i, /^(?:(?!\n||)*[^\n]*)/i, /^(?:accDescr\s*\{\s*)/i, /^(?:[\}])/i, /^(?:[^\}]*)/i, /^(?:%%(?!\{)*[^\n]*)/i, /^(?:[^\}]%%*[^\n]*)/i, /^(?:%%*[^\n]*[\n]*)/i, /^(?:[\n]+)/i, /^(?:\s+)/i, /^(?:%[^\n]*)/i, /^(?:href[\s]+["])/i, /^(?:["])/i, /^(?:[^"]*)/i, /^(?:call[\s]+)/i, /^(?:\([\s]*\))/i, /^(?:\()/i, /^(?:[^(]*)/i, /^(?:\))/i, /^(?:[^)]*)/i, /^(?:click[\s]+)/i, /^(?:[\s\n])/i, /^(?:[^\s\n]*)/i, /^(?:gantt\b)/i, /^(?:dateFormat\s[^#\n;]+)/i, /^(?:inclusiveEndDates\b)/i, /^(?:topAxis\b)/i, /^(?:axisFormat\s[^#\n;]+)/i, /^(?:tickInterval\s[^#\n;]+)/i, /^(?:includes\s[^#\n;]+)/i, /^(?:excludes\s[^#\n;]+)/i, /^(?:todayMarker\s[^\n;]+)/i, /^(?:weekday\s+monday\b)/i, /^(?:weekday\s+tuesday\b)/i, /^(?:weekday\s+wednesday\b)/i, /^(?:weekday\s+thursday\b)/i, /^(?:weekday\s+friday\b)/i, /^(?:weekday\s+saturday\b)/i, /^(?:weekday\s+sunday\b)/i, /^(?:weekend\s+friday\b)/i, /^(?:weekend\s+saturday\b)/i, /^(?:\d\d\d\d-\d\d-\d\d\b)/i, /^(?:title\s[^\n]+)/i, /^(?:accDescription\s[^#\n;]+)/i, /^(?:section\s[^\n]+)/i, /^(?:[^:\n]+)/i, /^(?::[^#\n;]+)/i, /^(?::)/i, /^(?:$)/i, /^(?:.)/i],
      conditions: { "acc_descr_multiline": { "rules": [6, 7], "inclusive": false }, "acc_descr": { "rules": [4], "inclusive": false }, "acc_title": { "rules": [2], "inclusive": false }, "callbackargs": { "rules": [21, 22], "inclusive": false }, "callbackname": { "rules": [18, 19, 20], "inclusive": false }, "href": { "rules": [15, 16], "inclusive": false }, "click": { "rules": [24, 25], "inclusive": false }, "INITIAL": { "rules": [0, 1, 3, 5, 8, 9, 10, 11, 12, 13, 14, 17, 23, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52], "inclusive": true } }
    };
    return lexer2;
  }();
  parser2.lexer = lexer;
  function Parser() {
    this.yy = {};
  }
  __name(Parser, "Parser");
  Parser.prototype = parser2;
  parser2.Parser = Parser;
  return new Parser();
}();
parser.parser = parser;
var gantt_default = parser;
dayjs2.extend(dayjsIsoWeek);
dayjs2.extend(dayjsCustomParseFormat);
dayjs2.extend(dayjsAdvancedFormat);
var WEEKEND_START_DAY = { friday: 5, saturday: 6 };
var dateFormat = "";
var axisFormat = "";
var tickInterval = void 0;
var todayMarker = "";
var includes = [];
var excludes = [];
var links = /* @__PURE__ */ new Map();
var sections = [];
var tasks = [];
var currentSection = "";
var displayMode = "";
var tags = ["active", "done", "crit", "milestone"];
var funs = [];
var inclusiveEndDates = false;
var topAxis = false;
var weekday = "sunday";
var weekend = "saturday";
var lastOrder = 0;
var clear2 = /* @__PURE__ */ __name(function() {
  sections = [];
  tasks = [];
  currentSection = "";
  funs = [];
  taskCnt = 0;
  lastTask = void 0;
  lastTaskID = void 0;
  rawTasks = [];
  dateFormat = "";
  axisFormat = "";
  displayMode = "";
  tickInterval = void 0;
  todayMarker = "";
  includes = [];
  excludes = [];
  inclusiveEndDates = false;
  topAxis = false;
  lastOrder = 0;
  links = /* @__PURE__ */ new Map();
  clear();
  weekday = "sunday";
  weekend = "saturday";
}, "clear");
var setAxisFormat = /* @__PURE__ */ __name(function(txt) {
  axisFormat = txt;
}, "setAxisFormat");
var getAxisFormat = /* @__PURE__ */ __name(function() {
  return axisFormat;
}, "getAxisFormat");
var setTickInterval = /* @__PURE__ */ __name(function(txt) {
  tickInterval = txt;
}, "setTickInterval");
var getTickInterval = /* @__PURE__ */ __name(function() {
  return tickInterval;
}, "getTickInterval");
var setTodayMarker = /* @__PURE__ */ __name(function(txt) {
  todayMarker = txt;
}, "setTodayMarker");
var getTodayMarker = /* @__PURE__ */ __name(function() {
  return todayMarker;
}, "getTodayMarker");
var setDateFormat = /* @__PURE__ */ __name(function(txt) {
  dateFormat = txt;
}, "setDateFormat");
var enableInclusiveEndDates = /* @__PURE__ */ __name(function() {
  inclusiveEndDates = true;
}, "enableInclusiveEndDates");
var endDatesAreInclusive = /* @__PURE__ */ __name(function() {
  return inclusiveEndDates;
}, "endDatesAreInclusive");
var enableTopAxis = /* @__PURE__ */ __name(function() {
  topAxis = true;
}, "enableTopAxis");
var topAxisEnabled = /* @__PURE__ */ __name(function() {
  return topAxis;
}, "topAxisEnabled");
var setDisplayMode = /* @__PURE__ */ __name(function(txt) {
  displayMode = txt;
}, "setDisplayMode");
var getDisplayMode = /* @__PURE__ */ __name(function() {
  return displayMode;
}, "getDisplayMode");
var getDateFormat = /* @__PURE__ */ __name(function() {
  return dateFormat;
}, "getDateFormat");
var setIncludes = /* @__PURE__ */ __name(function(txt) {
  includes = txt.toLowerCase().split(/[\s,]+/);
}, "setIncludes");
var getIncludes = /* @__PURE__ */ __name(function() {
  return includes;
}, "getIncludes");
var setExcludes = /* @__PURE__ */ __name(function(txt) {
  excludes = txt.toLowerCase().split(/[\s,]+/);
}, "setExcludes");
var getExcludes = /* @__PURE__ */ __name(function() {
  return excludes;
}, "getExcludes");
var getLinks = /* @__PURE__ */ __name(function() {
  return links;
}, "getLinks");
var addSection = /* @__PURE__ */ __name(function(txt) {
  currentSection = txt;
  sections.push(txt);
}, "addSection");
var getSections = /* @__PURE__ */ __name(function() {
  return sections;
}, "getSections");
var getTasks = /* @__PURE__ */ __name(function() {
  let allItemsProcessed = compileTasks();
  const maxDepth = 10;
  let iterationCount = 0;
  while (!allItemsProcessed && iterationCount < maxDepth) {
    allItemsProcessed = compileTasks();
    iterationCount++;
  }
  tasks = rawTasks;
  return tasks;
}, "getTasks");
var isInvalidDate = /* @__PURE__ */ __name(function(date, dateFormat2, excludes2, includes2) {
  if (includes2.includes(date.format(dateFormat2.trim()))) {
    return false;
  }
  if (excludes2.includes("weekends") && (date.isoWeekday() === WEEKEND_START_DAY[weekend] || date.isoWeekday() === WEEKEND_START_DAY[weekend] + 1)) {
    return true;
  }
  if (excludes2.includes(date.format("dddd").toLowerCase())) {
    return true;
  }
  return excludes2.includes(date.format(dateFormat2.trim()));
}, "isInvalidDate");
var setWeekday = /* @__PURE__ */ __name(function(txt) {
  weekday = txt;
}, "setWeekday");
var getWeekday = /* @__PURE__ */ __name(function() {
  return weekday;
}, "getWeekday");
var setWeekend = /* @__PURE__ */ __name(function(startDay) {
  weekend = startDay;
}, "setWeekend");
var checkTaskDates = /* @__PURE__ */ __name(function(task, dateFormat2, excludes2, includes2) {
  if (!excludes2.length || task.manualEndTime) {
    return;
  }
  let startTime;
  if (task.startTime instanceof Date) {
    startTime = dayjs2(task.startTime);
  } else {
    startTime = dayjs2(task.startTime, dateFormat2, true);
  }
  startTime = startTime.add(1, "d");
  let originalEndTime;
  if (task.endTime instanceof Date) {
    originalEndTime = dayjs2(task.endTime);
  } else {
    originalEndTime = dayjs2(task.endTime, dateFormat2, true);
  }
  const [fixedEndTime, renderEndTime] = fixTaskDates(
    startTime,
    originalEndTime,
    dateFormat2,
    excludes2,
    includes2
  );
  task.endTime = fixedEndTime.toDate();
  task.renderEndTime = renderEndTime;
}, "checkTaskDates");
var fixTaskDates = /* @__PURE__ */ __name(function(startTime, endTime, dateFormat2, excludes2, includes2) {
  let invalid = false;
  let renderEndTime = null;
  while (startTime <= endTime) {
    if (!invalid) {
      renderEndTime = endTime.toDate();
    }
    invalid = isInvalidDate(startTime, dateFormat2, excludes2, includes2);
    if (invalid) {
      endTime = endTime.add(1, "d");
    }
    startTime = startTime.add(1, "d");
  }
  return [endTime, renderEndTime];
}, "fixTaskDates");
var getStartDate = /* @__PURE__ */ __name(function(prevTime, dateFormat2, str) {
  str = str.trim();
  const afterRePattern = /^after\s+(?<ids>[\d\w- ]+)/;
  const afterStatement = afterRePattern.exec(str);
  if (afterStatement !== null) {
    let latestTask = null;
    for (const id of afterStatement.groups.ids.split(" ")) {
      let task = findTaskById(id);
      if (task !== void 0 && (!latestTask || task.endTime > latestTask.endTime)) {
        latestTask = task;
      }
    }
    if (latestTask) {
      return latestTask.endTime;
    }
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
  let mDate = dayjs2(str, dateFormat2.trim(), true);
  if (mDate.isValid()) {
    return mDate.toDate();
  } else {
    log.debug("Invalid date:" + str);
    log.debug("With date format:" + dateFormat2.trim());
    const d = new Date(str);
    if (d === void 0 || isNaN(d.getTime()) || // WebKit browsers can mis-parse invalid dates to be ridiculously
    // huge numbers, e.g. new Date('202304') gets parsed as January 1, 202304.
    // This can cause virtually infinite loops while rendering, so for the
    // purposes of Gantt charts we'll just treat any date beyond 10,000 AD/BC as
    // invalid.
    d.getFullYear() < -1e4 || d.getFullYear() > 1e4) {
      throw new Error("Invalid date:" + str);
    }
    return d;
  }
}, "getStartDate");
var parseDuration = /* @__PURE__ */ __name(function(str) {
  const statement = /^(\d+(?:\.\d+)?)([Mdhmswy]|ms)$/.exec(str.trim());
  if (statement !== null) {
    return [Number.parseFloat(statement[1]), statement[2]];
  }
  return [NaN, "ms"];
}, "parseDuration");
var getEndDate = /* @__PURE__ */ __name(function(prevTime, dateFormat2, str, inclusive = false) {
  str = str.trim();
  const untilRePattern = /^until\s+(?<ids>[\d\w- ]+)/;
  const untilStatement = untilRePattern.exec(str);
  if (untilStatement !== null) {
    let earliestTask = null;
    for (const id of untilStatement.groups.ids.split(" ")) {
      let task = findTaskById(id);
      if (task !== void 0 && (!earliestTask || task.startTime < earliestTask.startTime)) {
        earliestTask = task;
      }
    }
    if (earliestTask) {
      return earliestTask.startTime;
    }
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
  let parsedDate = dayjs2(str, dateFormat2.trim(), true);
  if (parsedDate.isValid()) {
    if (inclusive) {
      parsedDate = parsedDate.add(1, "d");
    }
    return parsedDate.toDate();
  }
  let endTime = dayjs2(prevTime);
  const [durationValue, durationUnit] = parseDuration(str);
  if (!Number.isNaN(durationValue)) {
    const newEndTime = endTime.add(durationValue, durationUnit);
    if (newEndTime.isValid()) {
      endTime = newEndTime;
    }
  }
  return endTime.toDate();
}, "getEndDate");
var taskCnt = 0;
var parseId = /* @__PURE__ */ __name(function(idStr) {
  if (idStr === void 0) {
    taskCnt = taskCnt + 1;
    return "task" + taskCnt;
  }
  return idStr;
}, "parseId");
var compileData = /* @__PURE__ */ __name(function(prevTask, dataStr) {
  let ds;
  if (dataStr.substr(0, 1) === ":") {
    ds = dataStr.substr(1, dataStr.length);
  } else {
    ds = dataStr;
  }
  const data = ds.split(",");
  const task = {};
  getTaskTags(data, task, tags);
  for (let i = 0; i < data.length; i++) {
    data[i] = data[i].trim();
  }
  let endTimeData = "";
  switch (data.length) {
    case 1:
      task.id = parseId();
      task.startTime = prevTask.endTime;
      endTimeData = data[0];
      break;
    case 2:
      task.id = parseId();
      task.startTime = getStartDate(void 0, dateFormat, data[0]);
      endTimeData = data[1];
      break;
    case 3:
      task.id = parseId(data[0]);
      task.startTime = getStartDate(void 0, dateFormat, data[1]);
      endTimeData = data[2];
      break;
  }
  if (endTimeData) {
    task.endTime = getEndDate(task.startTime, dateFormat, endTimeData, inclusiveEndDates);
    task.manualEndTime = dayjs2(endTimeData, "YYYY-MM-DD", true).isValid();
    checkTaskDates(task, dateFormat, excludes, includes);
  }
  return task;
}, "compileData");
var parseData = /* @__PURE__ */ __name(function(prevTaskId, dataStr) {
  let ds;
  if (dataStr.substr(0, 1) === ":") {
    ds = dataStr.substr(1, dataStr.length);
  } else {
    ds = dataStr;
  }
  const data = ds.split(",");
  const task = {};
  getTaskTags(data, task, tags);
  for (let i = 0; i < data.length; i++) {
    data[i] = data[i].trim();
  }
  switch (data.length) {
    case 1:
      task.id = parseId();
      task.startTime = {
        type: "prevTaskEnd",
        id: prevTaskId
      };
      task.endTime = {
        data: data[0]
      };
      break;
    case 2:
      task.id = parseId();
      task.startTime = {
        type: "getStartDate",
        startData: data[0]
      };
      task.endTime = {
        data: data[1]
      };
      break;
    case 3:
      task.id = parseId(data[0]);
      task.startTime = {
        type: "getStartDate",
        startData: data[1]
      };
      task.endTime = {
        data: data[2]
      };
      break;
  }
  return task;
}, "parseData");
var lastTask;
var lastTaskID;
var rawTasks = [];
var taskDb = {};
var addTask = /* @__PURE__ */ __name(function(descr, data) {
  const rawTask = {
    section: currentSection,
    type: currentSection,
    processed: false,
    manualEndTime: false,
    renderEndTime: null,
    raw: { data },
    task: descr,
    classes: []
  };
  const taskInfo = parseData(lastTaskID, data);
  rawTask.raw.startTime = taskInfo.startTime;
  rawTask.raw.endTime = taskInfo.endTime;
  rawTask.id = taskInfo.id;
  rawTask.prevTaskId = lastTaskID;
  rawTask.active = taskInfo.active;
  rawTask.done = taskInfo.done;
  rawTask.crit = taskInfo.crit;
  rawTask.milestone = taskInfo.milestone;
  rawTask.order = lastOrder;
  lastOrder++;
  const pos = rawTasks.push(rawTask);
  lastTaskID = rawTask.id;
  taskDb[rawTask.id] = pos - 1;
}, "addTask");
var findTaskById = /* @__PURE__ */ __name(function(id) {
  const pos = taskDb[id];
  return rawTasks[pos];
}, "findTaskById");
var addTaskOrg = /* @__PURE__ */ __name(function(descr, data) {
  const newTask = {
    section: currentSection,
    type: currentSection,
    description: descr,
    task: descr,
    classes: []
  };
  const taskInfo = compileData(lastTask, data);
  newTask.startTime = taskInfo.startTime;
  newTask.endTime = taskInfo.endTime;
  newTask.id = taskInfo.id;
  newTask.active = taskInfo.active;
  newTask.done = taskInfo.done;
  newTask.crit = taskInfo.crit;
  newTask.milestone = taskInfo.milestone;
  lastTask = newTask;
  tasks.push(newTask);
}, "addTaskOrg");
var compileTasks = /* @__PURE__ */ __name(function() {
  const compileTask = /* @__PURE__ */ __name(function(pos) {
    const task = rawTasks[pos];
    let startTime = "";
    switch (rawTasks[pos].raw.startTime.type) {
      case "prevTaskEnd": {
        const prevTask = findTaskById(task.prevTaskId);
        task.startTime = prevTask.endTime;
        break;
      }
      case "getStartDate":
        startTime = getStartDate(void 0, dateFormat, rawTasks[pos].raw.startTime.startData);
        if (startTime) {
          rawTasks[pos].startTime = startTime;
        }
        break;
    }
    if (rawTasks[pos].startTime) {
      rawTasks[pos].endTime = getEndDate(
        rawTasks[pos].startTime,
        dateFormat,
        rawTasks[pos].raw.endTime.data,
        inclusiveEndDates
      );
      if (rawTasks[pos].endTime) {
        rawTasks[pos].processed = true;
        rawTasks[pos].manualEndTime = dayjs2(
          rawTasks[pos].raw.endTime.data,
          "YYYY-MM-DD",
          true
        ).isValid();
        checkTaskDates(rawTasks[pos], dateFormat, excludes, includes);
      }
    }
    return rawTasks[pos].processed;
  }, "compileTask");
  let allProcessed = true;
  for (const [i, rawTask] of rawTasks.entries()) {
    compileTask(i);
    allProcessed = allProcessed && rawTask.processed;
  }
  return allProcessed;
}, "compileTasks");
var setLink = /* @__PURE__ */ __name(function(ids, _linkStr) {
  let linkStr = _linkStr;
  if (getConfig2().securityLevel !== "loose") {
    linkStr = sanitizeUrl_1(_linkStr);
  }
  ids.split(",").forEach(function(id) {
    let rawTask = findTaskById(id);
    if (rawTask !== void 0) {
      pushFun(id, () => {
        window.open(linkStr, "_self");
      });
      links.set(id, linkStr);
    }
  });
  setClass(ids, "clickable");
}, "setLink");
var setClass = /* @__PURE__ */ __name(function(ids, className) {
  ids.split(",").forEach(function(id) {
    let rawTask = findTaskById(id);
    if (rawTask !== void 0) {
      rawTask.classes.push(className);
    }
  });
}, "setClass");
var setClickFun = /* @__PURE__ */ __name(function(id, functionName, functionArgs) {
  if (getConfig2().securityLevel !== "loose") {
    return;
  }
  if (functionName === void 0) {
    return;
  }
  let argList = [];
  if (typeof functionArgs === "string") {
    argList = functionArgs.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    for (let i = 0; i < argList.length; i++) {
      let item = argList[i].trim();
      if (item.startsWith('"') && item.endsWith('"')) {
        item = item.substr(1, item.length - 2);
      }
      argList[i] = item;
    }
  }
  if (argList.length === 0) {
    argList.push(id);
  }
  let rawTask = findTaskById(id);
  if (rawTask !== void 0) {
    pushFun(id, () => {
      utils_default.runFunc(functionName, ...argList);
    });
  }
}, "setClickFun");
var pushFun = /* @__PURE__ */ __name(function(id, callbackFunction) {
  funs.push(
    function() {
      const elem = document.querySelector(`[id="${id}"]`);
      if (elem !== null) {
        elem.addEventListener("click", function() {
          callbackFunction();
        });
      }
    },
    function() {
      const elem = document.querySelector(`[id="${id}-text"]`);
      if (elem !== null) {
        elem.addEventListener("click", function() {
          callbackFunction();
        });
      }
    }
  );
}, "pushFun");
var setClickEvent = /* @__PURE__ */ __name(function(ids, functionName, functionArgs) {
  ids.split(",").forEach(function(id) {
    setClickFun(id, functionName, functionArgs);
  });
  setClass(ids, "clickable");
}, "setClickEvent");
var bindFunctions = /* @__PURE__ */ __name(function(element) {
  funs.forEach(function(fun) {
    fun(element);
  });
}, "bindFunctions");
var ganttDb_default = {
  getConfig: /* @__PURE__ */ __name(() => getConfig2().gantt, "getConfig"),
  clear: clear2,
  setDateFormat,
  getDateFormat,
  enableInclusiveEndDates,
  endDatesAreInclusive,
  enableTopAxis,
  topAxisEnabled,
  setAxisFormat,
  getAxisFormat,
  setTickInterval,
  getTickInterval,
  setTodayMarker,
  getTodayMarker,
  setAccTitle,
  getAccTitle,
  setDiagramTitle,
  getDiagramTitle,
  setDisplayMode,
  getDisplayMode,
  setAccDescription,
  getAccDescription,
  addSection,
  getSections,
  getTasks,
  addTask,
  findTaskById,
  addTaskOrg,
  setIncludes,
  getIncludes,
  setExcludes,
  getExcludes,
  setClickEvent,
  setLink,
  getLinks,
  bindFunctions,
  parseDuration,
  isInvalidDate,
  setWeekday,
  getWeekday,
  setWeekend
};
function getTaskTags(data, task, tags2) {
  let matchFound = true;
  while (matchFound) {
    matchFound = false;
    tags2.forEach(function(t) {
      const pattern = "^\\s*" + t + "\\s*$";
      const regex = new RegExp(pattern);
      if (data[0].match(regex)) {
        task[t] = true;
        data.shift(1);
        matchFound = true;
      }
    });
  }
}
__name(getTaskTags, "getTaskTags");
var setConf = /* @__PURE__ */ __name(function() {
  log.debug("Something is calling, setConf, remove the call");
}, "setConf");
var mapWeekdayToTimeFunction = {
  monday: timeMonday,
  tuesday: timeTuesday,
  wednesday: timeWednesday,
  thursday: timeThursday,
  friday: timeFriday,
  saturday: timeSaturday,
  sunday: timeSunday
};
var getMaxIntersections = /* @__PURE__ */ __name((tasks2, orderOffset) => {
  let timeline = [...tasks2].map(() => -Infinity);
  let sorted = [...tasks2].sort((a, b) => a.startTime - b.startTime || a.order - b.order);
  let maxIntersections = 0;
  for (const element of sorted) {
    for (let j = 0; j < timeline.length; j++) {
      if (element.startTime >= timeline[j]) {
        timeline[j] = element.endTime;
        element.order = j + orderOffset;
        if (j > maxIntersections) {
          maxIntersections = j;
        }
        break;
      }
    }
  }
  return maxIntersections;
}, "getMaxIntersections");
var w;
var draw = /* @__PURE__ */ __name(function(text, id, version, diagObj) {
  const conf = getConfig2().gantt;
  const securityLevel = getConfig2().securityLevel;
  let sandboxElement;
  if (securityLevel === "sandbox") {
    sandboxElement = select("#i" + id);
  }
  const root = securityLevel === "sandbox" ? select(sandboxElement.nodes()[0].contentDocument.body) : select("body");
  const doc = securityLevel === "sandbox" ? sandboxElement.nodes()[0].contentDocument : document;
  const elem = doc.getElementById(id);
  w = elem.parentElement.offsetWidth;
  if (w === void 0) {
    w = 1200;
  }
  if (conf.useWidth !== void 0) {
    w = conf.useWidth;
  }
  const taskArray = diagObj.db.getTasks();
  let categories = [];
  for (const element of taskArray) {
    categories.push(element.type);
  }
  categories = checkUnique(categories);
  const categoryHeights = {};
  let h = 2 * conf.topPadding;
  if (diagObj.db.getDisplayMode() === "compact" || conf.displayMode === "compact") {
    const categoryElements = {};
    for (const element of taskArray) {
      if (categoryElements[element.section] === void 0) {
        categoryElements[element.section] = [element];
      } else {
        categoryElements[element.section].push(element);
      }
    }
    let intersections = 0;
    for (const category of Object.keys(categoryElements)) {
      const categoryHeight = getMaxIntersections(categoryElements[category], intersections) + 1;
      intersections += categoryHeight;
      h += categoryHeight * (conf.barHeight + conf.barGap);
      categoryHeights[category] = categoryHeight;
    }
  } else {
    h += taskArray.length * (conf.barHeight + conf.barGap);
    for (const category of categories) {
      categoryHeights[category] = taskArray.filter((task) => task.type === category).length;
    }
  }
  elem.setAttribute("viewBox", "0 0 " + w + " " + h);
  const svg = root.select(`[id="${id}"]`);
  const timeScale = time().domain([
    min(taskArray, function(d) {
      return d.startTime;
    }),
    max(taskArray, function(d) {
      return d.endTime;
    })
  ]).rangeRound([0, w - conf.leftPadding - conf.rightPadding]);
  function taskCompare(a, b) {
    const taskA = a.startTime;
    const taskB = b.startTime;
    let result = 0;
    if (taskA > taskB) {
      result = 1;
    } else if (taskA < taskB) {
      result = -1;
    }
    return result;
  }
  __name(taskCompare, "taskCompare");
  taskArray.sort(taskCompare);
  makeGantt(taskArray, w, h);
  configureSvgSize(svg, h, w, conf.useMaxWidth);
  svg.append("text").text(diagObj.db.getDiagramTitle()).attr("x", w / 2).attr("y", conf.titleTopMargin).attr("class", "titleText");
  function makeGantt(tasks2, pageWidth, pageHeight) {
    const barHeight = conf.barHeight;
    const gap = barHeight + conf.barGap;
    const topPadding = conf.topPadding;
    const leftPadding = conf.leftPadding;
    const colorScale = linear().domain([0, categories.length]).range(["#00B9FA", "#F95002"]).interpolate(interpolateHcl);
    drawExcludeDays(
      gap,
      topPadding,
      leftPadding,
      pageWidth,
      pageHeight,
      tasks2,
      diagObj.db.getExcludes(),
      diagObj.db.getIncludes()
    );
    makeGrid(leftPadding, topPadding, pageWidth, pageHeight);
    drawRects(tasks2, gap, topPadding, leftPadding, barHeight, colorScale, pageWidth);
    vertLabels(gap, topPadding);
    drawToday(leftPadding, topPadding, pageWidth, pageHeight);
  }
  __name(makeGantt, "makeGantt");
  function drawRects(theArray, theGap, theTopPad, theSidePad, theBarHeight, theColorScale, w2) {
    const uniqueTaskOrderIds = [...new Set(theArray.map((item) => item.order))];
    const uniqueTasks = uniqueTaskOrderIds.map((id2) => theArray.find((item) => item.order === id2));
    svg.append("g").selectAll("rect").data(uniqueTasks).enter().append("rect").attr("x", 0).attr("y", function(d, i) {
      i = d.order;
      return i * theGap + theTopPad - 2;
    }).attr("width", function() {
      return w2 - conf.rightPadding / 2;
    }).attr("height", theGap).attr("class", function(d) {
      for (const [i, category] of categories.entries()) {
        if (d.type === category) {
          return "section section" + i % conf.numberSectionStyles;
        }
      }
      return "section section0";
    });
    const rectangles = svg.append("g").selectAll("rect").data(theArray).enter();
    const links2 = diagObj.db.getLinks();
    rectangles.append("rect").attr("id", function(d) {
      return d.id;
    }).attr("rx", 3).attr("ry", 3).attr("x", function(d) {
      if (d.milestone) {
        return timeScale(d.startTime) + theSidePad + 0.5 * (timeScale(d.endTime) - timeScale(d.startTime)) - 0.5 * theBarHeight;
      }
      return timeScale(d.startTime) + theSidePad;
    }).attr("y", function(d, i) {
      i = d.order;
      return i * theGap + theTopPad;
    }).attr("width", function(d) {
      if (d.milestone) {
        return theBarHeight;
      }
      return timeScale(d.renderEndTime || d.endTime) - timeScale(d.startTime);
    }).attr("height", theBarHeight).attr("transform-origin", function(d, i) {
      i = d.order;
      return (timeScale(d.startTime) + theSidePad + 0.5 * (timeScale(d.endTime) - timeScale(d.startTime))).toString() + "px " + (i * theGap + theTopPad + 0.5 * theBarHeight).toString() + "px";
    }).attr("class", function(d) {
      const res = "task";
      let classStr = "";
      if (d.classes.length > 0) {
        classStr = d.classes.join(" ");
      }
      let secNum = 0;
      for (const [i, category] of categories.entries()) {
        if (d.type === category) {
          secNum = i % conf.numberSectionStyles;
        }
      }
      let taskClass = "";
      if (d.active) {
        if (d.crit) {
          taskClass += " activeCrit";
        } else {
          taskClass = " active";
        }
      } else if (d.done) {
        if (d.crit) {
          taskClass = " doneCrit";
        } else {
          taskClass = " done";
        }
      } else {
        if (d.crit) {
          taskClass += " crit";
        }
      }
      if (taskClass.length === 0) {
        taskClass = " task";
      }
      if (d.milestone) {
        taskClass = " milestone " + taskClass;
      }
      taskClass += secNum;
      taskClass += " " + classStr;
      return res + taskClass;
    });
    rectangles.append("text").attr("id", function(d) {
      return d.id + "-text";
    }).text(function(d) {
      return d.task;
    }).attr("font-size", conf.fontSize).attr("x", function(d) {
      let startX = timeScale(d.startTime);
      let endX = timeScale(d.renderEndTime || d.endTime);
      if (d.milestone) {
        startX += 0.5 * (timeScale(d.endTime) - timeScale(d.startTime)) - 0.5 * theBarHeight;
      }
      if (d.milestone) {
        endX = startX + theBarHeight;
      }
      const textWidth = this.getBBox().width;
      if (textWidth > endX - startX) {
        if (endX + textWidth + 1.5 * conf.leftPadding > w2) {
          return startX + theSidePad - 5;
        } else {
          return endX + theSidePad + 5;
        }
      } else {
        return (endX - startX) / 2 + startX + theSidePad;
      }
    }).attr("y", function(d, i) {
      i = d.order;
      return i * theGap + conf.barHeight / 2 + (conf.fontSize / 2 - 2) + theTopPad;
    }).attr("text-height", theBarHeight).attr("class", function(d) {
      const startX = timeScale(d.startTime);
      let endX = timeScale(d.endTime);
      if (d.milestone) {
        endX = startX + theBarHeight;
      }
      const textWidth = this.getBBox().width;
      let classStr = "";
      if (d.classes.length > 0) {
        classStr = d.classes.join(" ");
      }
      let secNum = 0;
      for (const [i, category] of categories.entries()) {
        if (d.type === category) {
          secNum = i % conf.numberSectionStyles;
        }
      }
      let taskType = "";
      if (d.active) {
        if (d.crit) {
          taskType = "activeCritText" + secNum;
        } else {
          taskType = "activeText" + secNum;
        }
      }
      if (d.done) {
        if (d.crit) {
          taskType = taskType + " doneCritText" + secNum;
        } else {
          taskType = taskType + " doneText" + secNum;
        }
      } else {
        if (d.crit) {
          taskType = taskType + " critText" + secNum;
        }
      }
      if (d.milestone) {
        taskType += " milestoneText";
      }
      if (textWidth > endX - startX) {
        if (endX + textWidth + 1.5 * conf.leftPadding > w2) {
          return classStr + " taskTextOutsideLeft taskTextOutside" + secNum + " " + taskType;
        } else {
          return classStr + " taskTextOutsideRight taskTextOutside" + secNum + " " + taskType + " width-" + textWidth;
        }
      } else {
        return classStr + " taskText taskText" + secNum + " " + taskType + " width-" + textWidth;
      }
    });
    const securityLevel2 = getConfig2().securityLevel;
    if (securityLevel2 === "sandbox") {
      let sandboxElement2;
      sandboxElement2 = select("#i" + id);
      const doc2 = sandboxElement2.nodes()[0].contentDocument;
      rectangles.filter(function(d) {
        return links2.has(d.id);
      }).each(function(o) {
        var taskRect = doc2.querySelector("#" + o.id);
        var taskText = doc2.querySelector("#" + o.id + "-text");
        const oldParent = taskRect.parentNode;
        var Link = doc2.createElement("a");
        Link.setAttribute("xlink:href", links2.get(o.id));
        Link.setAttribute("target", "_top");
        oldParent.appendChild(Link);
        Link.appendChild(taskRect);
        Link.appendChild(taskText);
      });
    }
  }
  __name(drawRects, "drawRects");
  function drawExcludeDays(theGap, theTopPad, theSidePad, w2, h2, tasks2, excludes2, includes2) {
    if (excludes2.length === 0 && includes2.length === 0) {
      return;
    }
    let minTime;
    let maxTime;
    for (const { startTime, endTime } of tasks2) {
      if (minTime === void 0 || startTime < minTime) {
        minTime = startTime;
      }
      if (maxTime === void 0 || endTime > maxTime) {
        maxTime = endTime;
      }
    }
    if (!minTime || !maxTime) {
      return;
    }
    if (dayjs2(maxTime).diff(dayjs2(minTime), "year") > 5) {
      log.warn(
        "The difference between the min and max time is more than 5 years. This will cause performance issues. Skipping drawing exclude days."
      );
      return;
    }
    const dateFormat2 = diagObj.db.getDateFormat();
    const excludeRanges = [];
    let range = null;
    let d = dayjs2(minTime);
    while (d.valueOf() <= maxTime) {
      if (diagObj.db.isInvalidDate(d, dateFormat2, excludes2, includes2)) {
        if (!range) {
          range = {
            start: d,
            end: d
          };
        } else {
          range.end = d;
        }
      } else {
        if (range) {
          excludeRanges.push(range);
          range = null;
        }
      }
      d = d.add(1, "d");
    }
    const rectangles = svg.append("g").selectAll("rect").data(excludeRanges).enter();
    rectangles.append("rect").attr("id", function(d2) {
      return "exclude-" + d2.start.format("YYYY-MM-DD");
    }).attr("x", function(d2) {
      return timeScale(d2.start) + theSidePad;
    }).attr("y", conf.gridLineStartPadding).attr("width", function(d2) {
      const renderEnd = d2.end.add(1, "day");
      return timeScale(renderEnd) - timeScale(d2.start);
    }).attr("height", h2 - theTopPad - conf.gridLineStartPadding).attr("transform-origin", function(d2, i) {
      return (timeScale(d2.start) + theSidePad + 0.5 * (timeScale(d2.end) - timeScale(d2.start))).toString() + "px " + (i * theGap + 0.5 * h2).toString() + "px";
    }).attr("class", "exclude-range");
  }
  __name(drawExcludeDays, "drawExcludeDays");
  function makeGrid(theSidePad, theTopPad, w2, h2) {
    let bottomXAxis = axisBottom(timeScale).tickSize(-h2 + theTopPad + conf.gridLineStartPadding).tickFormat(timeFormat(diagObj.db.getAxisFormat() || conf.axisFormat || "%Y-%m-%d"));
    const reTickInterval = /^([1-9]\d*)(millisecond|second|minute|hour|day|week|month)$/;
    const resultTickInterval = reTickInterval.exec(
      diagObj.db.getTickInterval() || conf.tickInterval
    );
    if (resultTickInterval !== null) {
      const every = resultTickInterval[1];
      const interval = resultTickInterval[2];
      const weekday2 = diagObj.db.getWeekday() || conf.weekday;
      switch (interval) {
        case "millisecond":
          bottomXAxis.ticks(millisecond.every(every));
          break;
        case "second":
          bottomXAxis.ticks(second.every(every));
          break;
        case "minute":
          bottomXAxis.ticks(timeMinute.every(every));
          break;
        case "hour":
          bottomXAxis.ticks(timeHour.every(every));
          break;
        case "day":
          bottomXAxis.ticks(timeDay.every(every));
          break;
        case "week":
          bottomXAxis.ticks(mapWeekdayToTimeFunction[weekday2].every(every));
          break;
        case "month":
          bottomXAxis.ticks(timeMonth.every(every));
          break;
      }
    }
    svg.append("g").attr("class", "grid").attr("transform", "translate(" + theSidePad + ", " + (h2 - 50) + ")").call(bottomXAxis).selectAll("text").style("text-anchor", "middle").attr("fill", "#000").attr("stroke", "none").attr("font-size", 10).attr("dy", "1em");
    if (diagObj.db.topAxisEnabled() || conf.topAxis) {
      let topXAxis = axisTop(timeScale).tickSize(-h2 + theTopPad + conf.gridLineStartPadding).tickFormat(timeFormat(diagObj.db.getAxisFormat() || conf.axisFormat || "%Y-%m-%d"));
      if (resultTickInterval !== null) {
        const every = resultTickInterval[1];
        const interval = resultTickInterval[2];
        const weekday2 = diagObj.db.getWeekday() || conf.weekday;
        switch (interval) {
          case "millisecond":
            topXAxis.ticks(millisecond.every(every));
            break;
          case "second":
            topXAxis.ticks(second.every(every));
            break;
          case "minute":
            topXAxis.ticks(timeMinute.every(every));
            break;
          case "hour":
            topXAxis.ticks(timeHour.every(every));
            break;
          case "day":
            topXAxis.ticks(timeDay.every(every));
            break;
          case "week":
            topXAxis.ticks(mapWeekdayToTimeFunction[weekday2].every(every));
            break;
          case "month":
            topXAxis.ticks(timeMonth.every(every));
            break;
        }
      }
      svg.append("g").attr("class", "grid").attr("transform", "translate(" + theSidePad + ", " + theTopPad + ")").call(topXAxis).selectAll("text").style("text-anchor", "middle").attr("fill", "#000").attr("stroke", "none").attr("font-size", 10);
    }
  }
  __name(makeGrid, "makeGrid");
  function vertLabels(theGap, theTopPad) {
    let prevGap = 0;
    const numOccurrences = Object.keys(categoryHeights).map((d) => [d, categoryHeights[d]]);
    svg.append("g").selectAll("text").data(numOccurrences).enter().append(function(d) {
      const rows = d[0].split(common_default.lineBreakRegex);
      const dy = -(rows.length - 1) / 2;
      const svgLabel = doc.createElementNS("http://www.w3.org/2000/svg", "text");
      svgLabel.setAttribute("dy", dy + "em");
      for (const [j, row] of rows.entries()) {
        const tspan = doc.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.setAttribute("alignment-baseline", "central");
        tspan.setAttribute("x", "10");
        if (j > 0) {
          tspan.setAttribute("dy", "1em");
        }
        tspan.textContent = row;
        svgLabel.appendChild(tspan);
      }
      return svgLabel;
    }).attr("x", 10).attr("y", function(d, i) {
      if (i > 0) {
        for (let j = 0; j < i; j++) {
          prevGap += numOccurrences[i - 1][1];
          return d[1] * theGap / 2 + prevGap * theGap + theTopPad;
        }
      } else {
        return d[1] * theGap / 2 + theTopPad;
      }
    }).attr("font-size", conf.sectionFontSize).attr("class", function(d) {
      for (const [i, category] of categories.entries()) {
        if (d[0] === category) {
          return "sectionTitle sectionTitle" + i % conf.numberSectionStyles;
        }
      }
      return "sectionTitle";
    });
  }
  __name(vertLabels, "vertLabels");
  function drawToday(theSidePad, theTopPad, w2, h2) {
    const todayMarker2 = diagObj.db.getTodayMarker();
    if (todayMarker2 === "off") {
      return;
    }
    const todayG = svg.append("g").attr("class", "today");
    const today = /* @__PURE__ */ new Date();
    const todayLine = todayG.append("line");
    todayLine.attr("x1", timeScale(today) + theSidePad).attr("x2", timeScale(today) + theSidePad).attr("y1", conf.titleTopMargin).attr("y2", h2 - conf.titleTopMargin).attr("class", "today");
    if (todayMarker2 !== "") {
      todayLine.attr("style", todayMarker2.replace(/,/g, ";"));
    }
  }
  __name(drawToday, "drawToday");
  function checkUnique(arr) {
    const hash = {};
    const result = [];
    for (let i = 0, l = arr.length; i < l; ++i) {
      if (!Object.prototype.hasOwnProperty.call(hash, arr[i])) {
        hash[arr[i]] = true;
        result.push(arr[i]);
      }
    }
    return result;
  }
  __name(checkUnique, "checkUnique");
}, "draw");
var ganttRenderer_default = {
  setConf,
  draw
};

// src/diagrams/gantt/styles.js
var getStyles = /* @__PURE__ */ __name((options) => `
  .mermaid-main-font {
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }

  .exclude-range {
    fill: ${options.excludeBkgColor};
  }

  .section {
    stroke: none;
    opacity: 0.2;
  }

  .section0 {
    fill: ${options.sectionBkgColor};
  }

  .section2 {
    fill: ${options.sectionBkgColor2};
  }

  .section1,
  .section3 {
    fill: ${options.altSectionBkgColor};
    opacity: 0.2;
  }

  .sectionTitle0 {
    fill: ${options.titleColor};
  }

  .sectionTitle1 {
    fill: ${options.titleColor};
  }

  .sectionTitle2 {
    fill: ${options.titleColor};
  }

  .sectionTitle3 {
    fill: ${options.titleColor};
  }

  .sectionTitle {
    text-anchor: start;
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }


  /* Grid and axis */

  .grid .tick {
    stroke: ${options.gridColor};
    opacity: 0.8;
    shape-rendering: crispEdges;
  }

  .grid .tick text {
    font-family: ${options.fontFamily};
    fill: ${options.textColor};
  }

  .grid path {
    stroke-width: 0;
  }


  /* Today line */

  .today {
    fill: none;
    stroke: ${options.todayLineColor};
    stroke-width: 2px;
  }


  /* Task styling */

  /* Default task */

  .task {
    stroke-width: 2;
  }

  .taskText {
    text-anchor: middle;
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }

  .taskTextOutsideRight {
    fill: ${options.taskTextDarkColor};
    text-anchor: start;
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }

  .taskTextOutsideLeft {
    fill: ${options.taskTextDarkColor};
    text-anchor: end;
  }


  /* Special case clickable */

  .task.clickable {
    cursor: pointer;
  }

  .taskText.clickable {
    cursor: pointer;
    fill: ${options.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideLeft.clickable {
    cursor: pointer;
    fill: ${options.taskTextClickableColor} !important;
    font-weight: bold;
  }

  .taskTextOutsideRight.clickable {
    cursor: pointer;
    fill: ${options.taskTextClickableColor} !important;
    font-weight: bold;
  }


  /* Specific task settings for the sections*/

  .taskText0,
  .taskText1,
  .taskText2,
  .taskText3 {
    fill: ${options.taskTextColor};
  }

  .task0,
  .task1,
  .task2,
  .task3 {
    fill: ${options.taskBkgColor};
    stroke: ${options.taskBorderColor};
  }

  .taskTextOutside0,
  .taskTextOutside2
  {
    fill: ${options.taskTextOutsideColor};
  }

  .taskTextOutside1,
  .taskTextOutside3 {
    fill: ${options.taskTextOutsideColor};
  }


  /* Active task */

  .active0,
  .active1,
  .active2,
  .active3 {
    fill: ${options.activeTaskBkgColor};
    stroke: ${options.activeTaskBorderColor};
  }

  .activeText0,
  .activeText1,
  .activeText2,
  .activeText3 {
    fill: ${options.taskTextDarkColor} !important;
  }


  /* Completed task */

  .done0,
  .done1,
  .done2,
  .done3 {
    stroke: ${options.doneTaskBorderColor};
    fill: ${options.doneTaskBkgColor};
    stroke-width: 2;
  }

  .doneText0,
  .doneText1,
  .doneText2,
  .doneText3 {
    fill: ${options.taskTextDarkColor} !important;
  }


  /* Tasks on the critical line */

  .crit0,
  .crit1,
  .crit2,
  .crit3 {
    stroke: ${options.critBorderColor};
    fill: ${options.critBkgColor};
    stroke-width: 2;
  }

  .activeCrit0,
  .activeCrit1,
  .activeCrit2,
  .activeCrit3 {
    stroke: ${options.critBorderColor};
    fill: ${options.activeTaskBkgColor};
    stroke-width: 2;
  }

  .doneCrit0,
  .doneCrit1,
  .doneCrit2,
  .doneCrit3 {
    stroke: ${options.critBorderColor};
    fill: ${options.doneTaskBkgColor};
    stroke-width: 2;
    cursor: pointer;
    shape-rendering: crispEdges;
  }

  .milestone {
    transform: rotate(45deg) scale(0.8,0.8);
  }

  .milestoneText {
    font-style: italic;
  }
  .doneCritText0,
  .doneCritText1,
  .doneCritText2,
  .doneCritText3 {
    fill: ${options.taskTextDarkColor} !important;
  }

  .activeCritText0,
  .activeCritText1,
  .activeCritText2,
  .activeCritText3 {
    fill: ${options.taskTextDarkColor} !important;
  }

  .titleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${options.titleColor || options.textColor};
    font-family: var(--mermaid-font-family, "trebuchet ms", verdana, arial, sans-serif);
  }
`, "getStyles");
var styles_default = getStyles;

// src/diagrams/gantt/ganttDiagram.ts
var diagram = {
  parser: gantt_default,
  db: ganttDb_default,
  renderer: ganttRenderer_default,
  styles: styles_default
};

export { diagram };
