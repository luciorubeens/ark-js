import Base from '../base'

export default class Votes extends Base {
  all () {
    return this.http.get('votes')
  }

  get (id) {
    return this.http.get(`votes/${id}`)
  }
}
