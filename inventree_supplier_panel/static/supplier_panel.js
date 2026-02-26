
function getCookie(name) {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function resolveContext(data) {
  if (!data) {
    return {};
  }
  return data.context || data.panelContext || data;
}

export async function SelectCompany(context) {
  const skuInput = document.getElementById('sku');
  const supplierInput = document.getElementById('supplier');
  const result = document.getElementById('result');
  const loader = document.getElementById('loader');

  if (!skuInput || !supplierInput || !result || !loader) {
    return;
  }

  const sku = (skuInput.value || '').trim();
  const supplier = parseInt(supplierInput.value, 10);
  const partId = context && context.part_id ? context.part_id : null;
  const endpoint = (context && context.endpoint) || '/plugin/suppliercart/addsupplierpart.json';

  if (!sku) {
    result.textContent = 'Please provide part number';
    result.className = 'alert alert-block alert-danger';
    return;
  }

  if (!partId) {
    result.textContent = 'Missing part id';
    result.className = 'alert alert-block alert-danger';
    return;
  }

  loader.style.visibility = 'visible';

  try {
    const payload = {
      sku: sku,
      supplier: supplier,
      pk: partId,
    };

    const csrf = getCookie('csrftoken');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrf || '',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    let responseData = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = { message: await response.text() };
    }

    const message = responseData && responseData.message ? responseData.message : 'Unknown response';
    result.textContent = message;
    if (message === 'OK') {
      result.className = 'alert alert-block alert-success';
    } else {
      result.className = 'alert alert-block alert-danger';
    }
  } catch (error) {
    const message = error && error.message ? error.message : 'Request failed';
    result.textContent = message;
    result.className = 'alert alert-block alert-danger';
  } finally {
    loader.style.visibility = 'hidden';
  }
}

export function renderPanel(target, data) {

    if (!target) {
        console.error("No target provided to renderPanel");
        return;
    }

    const context = resolveContext(data);
    const suppliers = (context && context.suppliers) || [];
    const options = suppliers
      .map((supplier) => `<option value="${supplier.pk}">${supplier.name}</option>`)
      .join('');

    target.innerHTML = `
    <style>
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
    <div class='alert alert-block ' id='result'>&nbsp</div>
    <div id="loader" class="wheel"></div>
    <table class='table table-condensed'>
    <form>
    <tbody>
        <tr>
            <td> Select Supplier </td>
            <td> 
          <select id="supplier">
          ${options}
          </select>
            </td>
        </tr>
        <tr>
            <td> Exact supplier part number from suppliers WEB page</td>
            <td> 
                <input id="sku" type="text" value="">
            </td>
        </tr>
    </tbody>
    <tfoot>
        <tr>
      <td>
                <input type="button" value="Add Part" id="supplier-panel-submit" title='Add Part' />
      </td>
      <td> </td>
        </tr>
    </tfoot>
    </form>
    </table>
    `;

    const button = target.querySelector('#supplier-panel-submit');
    if (button) {
      button.addEventListener('click', () => SelectCompany(context));
    }
}
