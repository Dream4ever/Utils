const config = {
  // mode 为 manual 时，手动指定每个二维码的编号
  // mode 为 auto 时，根据起始编号和数量自动生成
  mode: 'manual',
  baseUrl: 'https://www.shiyoubite.com/tspt/clkxjc/index.html?v=',
  // auto mode 所需参数
  startIndex: 3,
  count: 5,
  // manual mode 二维码编号
  ids: ['1', '2', '3', '4', '5', '6', '7', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '32', '33', '34', '35', '36', '37', '38', '39', '40'],
}

export default config
