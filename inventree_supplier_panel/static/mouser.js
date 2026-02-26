export function renderPanel(target, data) {
  if (!target) {
    console.error('No target provided to renderPanel');
    return;
  }

  const context = (data && (data.context || data.panelContext || data)) || {};
  const orderPk = context.order_pk || context.order_id || null;
  const transferEndpoint = context.transfer_endpoint || '';

  target.innerHTML = `
    <style>
    table.align-right-6rd-column th:nth-child(6),td:nth-child(6) {
      text-align: right;
    }
    table.align-right-7rd-column th:nth-child(7),td:nth-child(7) {
      text-align: right;
    }
    table th {
      padding: 8px;
    }
    .wheel {
      border: 5px solid #f3f3f3;
      border-top: 5px solid #3498db;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      animation: spin 2s linear infinite;
      visibility: hidden;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    </style>

    <button type='button' class='btn btn-dark' id='transfer-btn' title='Transfer PO to Supplier'>
      <span class='fas fa-redo-alt'></span> Transfer PO
    </button>
    <br>
    <div width='30px' id='loader' class='wheel'></div>
    <div class='alert alert-block' id='result'>&nbsp</div>
    <b>Created supplier key:</b> <span id='cart_key'>  </span>
    <br>
    <b>Cart date:</b> <span id='cart_date'>  </span>
    <br>
    <div id='myDynamicTable'></div>
  `;

  function safeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function createTable(cartData) {
    if (!cartData) {
      return;
    }

    const tableHeadStrings = [
      'IPN',
      'SKU',
      'Required',
      'Available',
      'Status',
      'Price',
      'Total',
      'Notes'
    ];

    const currencyCode = cartData.currency_code || '';
    const total = safeNumber(cartData.MerchandiseTotal).toFixed(4);

    const tableFootStrings = [
      '',
      '',
      '',
      '',
      'Total',
      currencyCode,
      total,
      ''
    ];

    const myTableDiv = target.querySelector('#myDynamicTable');
    if (!myTableDiv) {
      return;
    }
    myTableDiv.innerHTML = '';

    const table = document.createElement('table');
    table.classList.add('table', 'table-condensed', 'align-right-6rd-column', 'align-right-7rd-column');

    const tableHead = document.createElement('thead');
    table.appendChild(tableHead);
    tableHeadStrings.forEach((item) => {
      const th = document.createElement('th');
      th.appendChild(document.createTextNode(item));
      tableHead.appendChild(th);
    });

    const tableBody = document.createElement('tbody');
    table.appendChild(tableBody);

    const items = Array.isArray(cartData.CartItems) ? cartData.CartItems : [];
    items.forEach((item) => {
      const tr = document.createElement('tr');
      tableBody.appendChild(tr);

      let td = document.createElement('td');
      td.appendChild(document.createTextNode(item.IPN || ''));
      tr.appendChild(td);

      td = document.createElement('td');
      td.appendChild(document.createTextNode(item.SKU || ''));
      tr.appendChild(td);

      td = document.createElement('td');
      td.appendChild(document.createTextNode(item.QuantityRequested ?? ''));
      tr.appendChild(td);

      td = document.createElement('td');
      td.appendChild(document.createTextNode(item.QuantityAvailable ?? ''));
      tr.appendChild(td);

      td = document.createElement('td');
      td.classList.add('badge', 'badge-left', 'rounded-pill');
      if (safeNumber(item.QuantityRequested) < safeNumber(item.QuantityAvailable)) {
        td.appendChild(document.createTextNode('OK'));
        td.classList.add('bg-success');
      } else {
        td.appendChild(document.createTextNode('Not OK'));
        td.classList.add('bg-danger');
      }
      tr.appendChild(td);

      td = document.createElement('td');
      td.appendChild(document.createTextNode(safeNumber(item.UnitPrice).toFixed(4)));
      tr.appendChild(td);

      td = document.createElement('td');
      td.appendChild(document.createTextNode(safeNumber(item.ExtendedPrice).toFixed(4)));
      tr.appendChild(td);

      td = document.createElement('td');
      td.appendChild(document.createTextNode(item.Error || ''));
      tr.appendChild(td);
    });

    const tableFoot = document.createElement('tfoot');
    table.appendChild(tableFoot);
    tableFootStrings.forEach((item) => {
      const tf = document.createElement('td');
      tf.appendChild(document.createTextNode(item));
      tf.style.textAlign = 'right';
      tableFoot.appendChild(tf);
    });

    myTableDiv.appendChild(table);
  }

  function extractCart(metadata) {
    if (!metadata) {
      return null;
    }
    try {
      const data = typeof metadata === 'string'
        ? JSON.parse(metadata.replace(/&#x27;/gm, '"'))
        : metadata;
      return data && data.SupplierCart && data.SupplierCart.cart ? data.SupplierCart.cart : null;
    } catch {
      return null;
    }
  }

  function updateHeader(cartData) {
    const cartKey = target.querySelector('#cart_key');
    const cartDate = target.querySelector('#cart_date');
    if (cartKey) {
      cartKey.textContent = cartData && cartData.cart_key ? cartData.cart_key : '';
    }
    if (cartDate) {
      cartDate.textContent = cartData && cartData.cart_date ? cartData.cart_date : '';
    }
  }

  async function transferCart() {
    const loader = target.querySelector('#loader');
    const result = target.querySelector('#result');

    if (!orderPk && !transferEndpoint) {
      if (result) {
        result.textContent = 'Missing order id';
        result.className = 'alert alert-block alert-danger';
      }
      return;
    }

    if (loader) {
      loader.style.visibility = 'visible';
    }

    try {
      const urlCandidates = [];
      if (transferEndpoint) {
        urlCandidates.push(transferEndpoint);
      }
      if (orderPk) {
        urlCandidates.push(`/plugin/suppliercart/transfercart/${orderPk}/`);
      }

      let responseData = null;
      let lastError = 'Request failed.';

      for (const url of urlCandidates) {
        const response = await fetch(url, { credentials: 'same-origin' });
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok) {
          lastError = `HTTP ${response.status}`;
          continue;
        }

        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = null;
        }

        if (responseData) {
          break;
        }
      }

      if (!responseData) {
        if (result) {
          result.textContent = lastError;
          result.className = 'alert alert-block alert-danger';
        }
        return;
      }

      if (result) {
        result.textContent = responseData.message || '';
        if (responseData.message === 'OK') {
          result.className = 'alert alert-block alert-success';
        } else {
          result.className = 'alert alert-block alert-danger';
        }
      }

      const cart = responseData.SupplierCart && responseData.SupplierCart.cart ? responseData.SupplierCart.cart : responseData;
      updateHeader(cart);
      createTable(cart);
    } catch (error) {
      if (result) {
        result.textContent = error && error.message ? error.message : 'Request failed';
        result.className = 'alert alert-block alert-danger';
      }
    } finally {
      if (loader) {
        loader.style.visibility = 'hidden';
      }
    }
  }

  const initialCart = extractCart(context.cart_data || context.cart || context.metadata);
  if (initialCart) {
    updateHeader(initialCart);
    createTable(initialCart);
  }

  const button = target.querySelector('#transfer-btn');
  if (button) {
    button.addEventListener('click', transferCart);
  }
}
