var Ractive = require('ractive'),
    Swiper  = require('../../lib/swiper/idangerous.swiper.js');

module.exports = Ractive.extend({
  template: '<div class="swiper-container"><div class="swiper-wrapper">{{> content }}</div></div>',
  isolated: false,
  twoway: true,
  debug: true,
  onrender: function () {
    var self = this;

    this.sliderOpts = {
      slideClass: 'carousel-item',
      calculateHeight: true,
      initialSlide: this.get('activeSlide'),
      onSlideChangeEnd: handleSlideChange.bind(this)
    };

    function handleSlideChange() {
      this.set('activeSlide', this.swiper.activeIndex);
    }

    this.node = this.find('.swiper-container');

    this.observe('*', function (newValue, oldValue, keypath) {
      if (self.swiper && keypath != 'activeSlide') {
        self.swiper.reInit();
      }
    }, { defer: true });

    this.observe('activeSlide', function (newValue) {
      if (self.swiper) {
        self.swiper.swipeTo( newValue );
      }
    })
  },
  oncomplete: function () {
    this.swiper = new Swiper(
      this.node,
      this.sliderOpts
    );
  },
  teardown: function () {
    if (this.swiper) {
      this.swiper.destroy();
    }
  }
});