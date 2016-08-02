'use strict'

Vue.use(VueResource);

Vue.filter('date', function (val, format) {
  return !!val
    ? moment(val).format(format)
    : val;
})

var app = new Vue({
  el: '#app-mount',
  data() {
    return {
      users: [],
      interactions: [],
    };
  },
  computed: {
    _availableUsers() {
      return this.users.filter(this.isAvailable);
    }
  },
  methods: {
    isAvailable(user) {
      return user.loggedIn && !user.onPhone && user.statusName === 'Available';
    },
    formatTimer: function (s) {
      var seconds = Math.floor(s);
      var minutes = Math.floor(s / 60);
      var hours = Math.floor(s / 60 / 60);
      // var days = Math.floor(ms /  1000 / 60 / 60 / 24);

      return [
        ('0' + hours % 24).slice(-2),
        ':',
        ('0' + minutes % 60).slice(-2),
        ':',
        ('0' + seconds % 60).slice(-2),
      ].join('');
    }

  },
  ready() {
    setInterval(function () {
      /**
       * Get users.
       */
      this.$http.get('/users')
      .then(
        function (response) {
          this.users = response
            .data
            .map(function (user) { return user; });
        }, function (err) {
          console.log(err);
        });

        /**
         * Get interactions
         */
        this.$http.get('/interactions')
        .then(
          function (response) {
            this.interactions = (response.data.activeInteractions || [])
              .map(function (interaction) {
                var user = (this.users.filter(function (usr) { return usr.id === interaction.userName; }) || [])[0]

                return Object.assign({}, interaction, { user: user })
              }.bind(this));

            console.log(JSON.parse(JSON.stringify(this.interactions)))
          }, function (err) {
            console.log(err);
          });

    }.bind(this), 1000);
  },
})
