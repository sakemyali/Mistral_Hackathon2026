class BaseService {
  constructor(name) {
    this.name = name;
    this.ready = false;
  }

  async init() {
    this.ready = true;
  }

  async process(input) {
    throw new Error(`${this.name}.process() not implemented`);
  }
}

module.exports = BaseService;
