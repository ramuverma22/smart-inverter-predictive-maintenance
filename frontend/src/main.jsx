import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Cpu,
  Gauge,
  LogOut,
  Plus,
  Thermometer,
  Zap
} from 'lucide-react';

import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import './styles.css';


// =====================================================
// API URL
// =====================================================

const API =
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000';


// =====================================================
// METRIC CARD
// =====================================================

const card = (
  label,
  value,
  unit,
  icon,
  tone
) => (
  <div className="metric">

    <span className={'icon ' + tone}>
      {icon}
    </span>

    <div>
      <small>{label}</small>

      <strong>
        {value}
        <em>{unit}</em>
      </strong>
    </div>

  </div>
);


// =====================================================
// AUTH PAGE
// =====================================================

function Auth({ onAuth }) {

  const [mode, setMode] = useState('login');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [error, setError] = useState('');


  const submit = async (e) => {

    e.preventDefault();

    setError('');

    try {

      const endpoint =
        mode === 'login'
          ? 'login'
          : 'register';

      const r = await fetch(
        `${API}/api/auth/${endpoint}`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify(form)
        }
      );


      const data = await r.json();


      if (!r.ok) {

        throw new Error(
          data.detail || 'Authentication failed'
        );

      }


      localStorage.setItem(
        'token',
        data.access_token
      );


      onAuth(data.user);


    } catch (e) {

      setError(
        e.message || 'Something went wrong'
      );

    }

  };


  return (

    <main className="auth">

      <section>

        <div className="brand">

          <Zap />

          Inverter
          <span>Sentinel</span>

        </div>


        <h1>
          Keep every watt
          <br />
          working smarter.
        </h1>


        <p>
          Real-time monitoring and predictive maintenance
          for your inverter fleet.
        </p>


        <div className="auth-stats">

          <b>
            99.9%
            <small>
              uptime visibility
            </small>
          </b>


          <b>
            24/7
            <small>
              smart monitoring
            </small>
          </b>

        </div>

      </section>


      <form onSubmit={submit}>

        <h2>
          {mode === 'login'
            ? 'Welcome back'
            : 'Create account'}
        </h2>


        <p>
          {mode === 'login'
            ? 'Sign in to your monitoring workspace.'
            : 'Start monitoring in minutes.'}
        </p>


        {mode === 'register' && (

          <input
            placeholder="Your name"
            required
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value
              })
            }
          />

        )}


        <input
          type="email"
          placeholder="Email address"
          required
          value={form.email}
          onChange={(e) =>
            setForm({
              ...form,
              email: e.target.value
            })
          }
        />


        <input
          type="password"
          placeholder="Password"
          minLength="6"
          required
          value={form.password}
          onChange={(e) =>
            setForm({
              ...form,
              password: e.target.value
            })
          }
        />


        {error && (
          <div className="error">
            {error}
          </div>
        )}


        <button type="submit">

          {mode === 'login'
            ? 'Sign in'
            : 'Create account'}

        </button>


        <button
          type="button"
          className="link"
          onClick={() =>
            setMode(
              mode === 'login'
                ? 'register'
                : 'login'
            )
          }
        >

          {mode === 'login'
            ? 'New here? Create an account'
            : 'Already have an account? Sign in'}

        </button>

      </form>

    </main>
  );
}


// =====================================================
// DASHBOARD
// =====================================================

function Dashboard({
  user,
  onLogout
}) {

  const [devices, setDevices] = useState([]);

  const [activeDevice, setActiveDevice] =
    useState(null);

  const [data, setData] = useState(null);

  const [adding, setAdding] =
    useState(false);

  // This controls the sidebar page
  const [page, setPage] =
    useState('overview');


  const token =
    localStorage.getItem('token');


  const headers = {

    Authorization:
      `Bearer ${token}`,

    'Content-Type':
      'application/json'

  };


  // ===================================================
  // LOAD DEVICES
  // ===================================================

  const load = async () => {

    try {

      const r = await fetch(
        `${API}/api/devices`,
        {
          headers
        }
      );


      if (!r.ok) {

        onLogout();

        return;

      }


      const d = await r.json();


      setDevices(d);


      if (d.length > 0) {

        setActiveDevice(
          current =>
            current || d[0].id
        );

      }

    } catch (error) {

      console.error(
        'Failed to load devices:',
        error
      );

    }

  };


  // ===================================================
  // LOAD DASHBOARD DATA
  // ===================================================

  const loadDashboard = async () => {

    if (!activeDevice) {
      return;
    }


    try {

      const r = await fetch(
        `${API}/api/dashboard/${activeDevice}`,
        {
          headers
        }
      );


      if (r.ok) {

        const d = await r.json();

        setData(d);

      }

    } catch (error) {

      console.error(
        'Failed to load dashboard:',
        error
      );

    }

  };


  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {

    load();

  }, []);


  // ===================================================
  // REFRESH DATA EVERY 5 SECONDS
  // ===================================================

  useEffect(() => {

    loadDashboard();


    const timer =
      setInterval(
        loadDashboard,
        5000
      );


    return () =>
      clearInterval(timer);

  }, [activeDevice]);


  // ===================================================
  // ADD DEVICE
  // ===================================================

  const add = async (e) => {

    e.preventDefault();


    const f =
      new FormData(e.target);


    try {

      const r = await fetch(
        `${API}/api/devices`,
        {
          method: 'POST',

          headers,

          body: JSON.stringify({

            name:
              f.get('name'),

            location:
              f.get('location'),

            capacity:
              Number(
                f.get('capacity')
              )

          })

        }
      );


      if (!r.ok) {

        const errorData =
          await r.json().catch(
            () => ({})
          );


        alert(
          errorData.detail ||
          'Failed to add device'
        );

        return;

      }


      setAdding(false);


      await load();

    } catch (error) {

      console.error(error);

      alert(
        'Failed to add device'
      );

    }

  };


  // ===================================================
  // PREPARE DATA
  // ===================================================

  const latest =
    data?.latest;


  const prediction =
    data?.prediction;


  const readings =
    (data?.readings || []).map(
      (x) => ({

        ...x,

        time:
          new Date(
            x.created_at
          ).toLocaleTimeString(
            [],
            {
              hour: '2-digit',
              minute: '2-digit'
            }
          )

      })
    );


  // ===================================================
  // SIDEBAR
  // ===================================================

  const Sidebar = () => (

    <aside>

      <div className="brand">

        <Zap />

        Inverter
        <span>Sentinel</span>

      </div>


      <nav>

        {/* OVERVIEW */}

        <a
          className={
            page === 'overview'
              ? 'selected'
              : ''
          }

          onClick={() =>
            setPage('overview')
          }
        >

          <Gauge />

          Overview

        </a>


        {/* LIVE TELEMETRY */}

        <a
          className={
            page === 'telemetry'
              ? 'selected'
              : ''
          }

          onClick={() =>
            setPage('telemetry')
          }
        >

          <Activity />

          Live telemetry

        </a>


        {/* ALERTS */}

        <a
          className={
            page === 'alerts'
              ? 'selected'
              : ''
          }

          onClick={() =>
            setPage('alerts')
          }
        >

          <AlertTriangle />

          Alerts

        </a>


        {/* DEVICES */}

        <a
          className={
            page === 'devices'
              ? 'selected'
              : ''
          }

          onClick={() =>
            setPage('devices')
          }
        >

          <Cpu />

          Devices

        </a>

      </nav>


      {/* USER PROFILE */}

      <div className="profile">

        <div>

          {user?.name
            ? user.name[0].toUpperCase()
            : 'U'}

        </div>


        <span>

          {user?.name}

          <small>
            {user?.email}
          </small>

        </span>


        <button
          onClick={onLogout}
        >

          <LogOut size={17} />

        </button>

      </div>

    </aside>

  );


  // ===================================================
  // OVERVIEW PAGE
  // ===================================================

  const OverviewPage = () => {

    if (!devices.length) {

      return (

        <section className="empty">

          <Cpu size={36} />

          <h2>
            Add your first inverter
          </h2>

          <p>
            Create a device to begin
            ingesting ESP32 telemetry.
          </p>


          <button
            onClick={() =>
              setAdding(true)
            }
          >

            Add device

          </button>

        </section>

      );

    }


    return (

      <>

        {/* HERO */}

        <section className="hero">

          <div>

            <span className="live">

              <i />

              LIVE SYSTEM STATUS

            </span>


            <h2>

              {prediction?.health_score < 60

                ? 'Attention needed'

                : prediction?.is_anomaly

                ? 'Anomaly detected'

                : 'All systems operating normally'}

            </h2>


            <p>

              {latest

                ? `Last data received ${new Date(
                    latest.created_at
                  ).toLocaleTimeString()}`

                : 'Waiting for the first sensor reading.'}

            </p>

          </div>


          <div className="score">

            <small>
              AI HEALTH SCORE
            </small>


            <b>

              {prediction?.health_score ?? '--'}

              <em>
                /100
              </em>

            </b>

          </div>

        </section>


        {/* METRICS */}

        <section className="metrics">

          {card(
            'OUTPUT VOLTAGE',
            latest?.voltage ?? '--',
            'V',
            <Zap />,
            'amber'
          )}


          {card(
            'POWER DRAW',
            latest?.power ?? '--',
            'kW',
            <Gauge />,
            'blue'
          )}


          {card(
            'TEMPERATURE',
            latest?.temperature ?? '--',
            '°C',
            <Thermometer />,
            'pink'
          )}


          {card(
            'BATTERY LEVEL',
            latest?.battery ?? '--',
            '%',
            <BatteryCharging />,
            'green'
          )}

        </section>


        {/* CHART + ALERTS */}

        <section className="grid">

          {/* CHART */}

          <div className="chart panel">

            <div className="panel-title">

              <div>

                <h3>
                  Performance trends
                </h3>

                <p>
                  Voltage and temperature over time
                  · refreshes every 5s
                </p>

              </div>


              <span>
                Last 24 hours
              </span>

            </div>


            <ResponsiveContainer
              width="100%"
              height={265}
            >

              <AreaChart
                data={
                  readings.length
                    ? readings
                    : [
                        {
                          time: 'No data',
                          voltage: 0,
                          temperature: 0
                        }
                      ]
                }
              >

                <defs>

                  <linearGradient
                    id="voltage"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >

                    <stop
                      stopColor="#5d5fef"
                      stopOpacity=".35"
                    />

                    <stop
                      offset="1"
                      stopColor="#5d5fef"
                      stopOpacity="0"
                    />

                  </linearGradient>

                </defs>


                <CartesianGrid
                  stroke="#edf0f6"
                  vertical={false}
                />


                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                />


                <YAxis
                  axisLine={false}
                  tickLine={false}
                />


                <Tooltip />


                <Area
                  type="monotone"
                  dataKey="voltage"
                  stroke="#5d5fef"
                  strokeWidth="3"
                  fill="url(#voltage)"
                />

              </AreaChart>

            </ResponsiveContainer>

          </div>


          {/* ALERTS */}

          <div className="panel alerts">

            <div className="panel-title">

              <div>

                <h3>
                  Recent alerts
                </h3>

                <p>
                  Fault detection activity
                </p>

              </div>


              <span
                className="view"
                onClick={() =>
                  setPage('alerts')
                }
              >

                View all

              </span>

            </div>


            {data?.faults?.length ? (

              data.faults.map(
                (f) => (

                  <div
                    className="alert"
                    key={f.id}
                  >

                    <span
                      className={f.severity}
                    >

                      <AlertTriangle
                        size={17}
                      />

                    </span>


                    <div>

                      <b>
                        {f.message}
                      </b>


                      <small>

                        {new Date(
                          f.created_at
                        ).toLocaleString()}

                      </small>

                    </div>

                  </div>

                )
              )

            ) : (

              <div className="no-alert">

                <span>
                  ✓
                </span>

                <b>
                  No active alerts
                </b>

                <p>
                  Your inverter is within
                  healthy operating ranges.
                </p>

              </div>

            )}

          </div>

        </section>

      </>

    );

  };


  // ===================================================
  // LIVE TELEMETRY PAGE
  // ===================================================

  const TelemetryPage = () => (

    <section>

      <div className="panel">

        <div className="panel-title">

          <div>

            <h3>
              Live telemetry
            </h3>

            <p>
              Real-time inverter sensor readings
            </p>

          </div>


          <span>
            Refreshing every 5 seconds
          </span>

        </div>


        <div className="metrics">

          {card(
            'OUTPUT VOLTAGE',
            latest?.voltage ?? '--',
            'V',
            <Zap />,
            'amber'
          )}


          {card(
            'CURRENT',
            latest?.current ?? '--',
            'A',
            <Activity />,
            'blue'
          )}


          {card(
            'POWER DRAW',
            latest?.power ?? '--',
            'kW',
            <Gauge />,
            'blue'
          )}


          {card(
            'TEMPERATURE',
            latest?.temperature ?? '--',
            '°C',
            <Thermometer />,
            'pink'
          )}


          {card(
            'BATTERY LEVEL',
            latest?.battery ?? '--',
            '%',
            <BatteryCharging />,
            'green'
          )}


          {card(
            'FREQUENCY',
            latest?.frequency ?? '--',
            'Hz',
            <Activity />,
            'amber'
          )}

        </div>

      </div>


      <div className="panel chart">

        <div className="panel-title">

          <div>

            <h3>
              Live voltage history
            </h3>

            <p>
              Sensor readings from your inverter
            </p>

          </div>

        </div>


        <ResponsiveContainer
          width="100%"
          height={350}
        >

          <AreaChart
            data={
              readings.length
                ? readings
                : [
                    {
                      time: 'No data',
                      voltage: 0
                    }
                  ]
            }
          >

            <CartesianGrid
              stroke="#edf0f6"
              vertical={false}
            />


            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
            />


            <YAxis
              axisLine={false}
              tickLine={false}
            />


            <Tooltip />


            <Area
              type="monotone"
              dataKey="voltage"
              stroke="#5d5fef"
              strokeWidth="3"
              fill="url(#voltage)"
            />

          </AreaChart>

        </ResponsiveContainer>

      </div>

    </section>

  );


  // ===================================================
  // ALERTS PAGE
  // ===================================================

  const AlertsPage = () => (

    <section>

      <div className="panel">

        <div className="panel-title">

          <div>

            <h3>
              Alerts
            </h3>

            <p>
              Fault detection and inverter warnings
            </p>

          </div>

        </div>


        {data?.faults?.length ? (

          data.faults.map(
            (f) => (

              <div
                className="alert"
                key={f.id}
              >

                <span
                  className={f.severity}
                >

                  <AlertTriangle
                    size={20}
                  />

                </span>


                <div>

                  <b>
                    {f.message}
                  </b>


                  <small>
                    Severity: {f.severity}
                  </small>


                  <small>

                    {new Date(
                      f.created_at
                    ).toLocaleString()}

                  </small>

                </div>

              </div>

            )

          )

        ) : (

          <div className="no-alert">

            <span>
              ✓
            </span>

            <b>
              No active alerts
            </b>

            <p>
              Your inverter is operating normally.
            </p>

          </div>

        )}

      </div>

    </section>

  );


  // ===================================================
  // DEVICES PAGE
  // ===================================================

  const DevicesPage = () => (

    <section>

      <div className="panel">

        <div className="panel-title">

          <div>

            <h3>
              Your inverters
            </h3>

            <p>
              Manage your connected inverter devices
            </p>

          </div>


          <button
            onClick={() =>
              setAdding(true)
            }
          >

            <Plus size={18} />

            Add device

          </button>

        </div>


        {devices.length ? (

          devices.map(
            (d) => (

              <div
                className="alert"
                key={d.id}
                style={{
                  marginBottom: '12px'
                }}
              >

                <span className="green">

                  <Cpu size={20} />

                </span>


                <div
                  style={{
                    flex: 1
                  }}
                >

                  <b>
                    {d.name}
                  </b>


                  <small>
                    Location: {d.location}
                  </small>


                  <small>
                    Capacity: {d.capacity} kW
                  </small>

                </div>


                <button
                  onClick={() => {

                    setActiveDevice(
                      d.id
                    );

                    setPage(
                      'overview'
                    );

                  }}
                >

                  View

                </button>

              </div>

            )

          )

        ) : (

          <div className="no-alert">

            <b>
              No devices found
            </b>

            <p>
              Add an inverter to start monitoring.
            </p>

          </div>

        )}

      </div>

    </section>

  );


  // ===================================================
  // MAIN DASHBOARD UI
  // ===================================================

  return (

    <div className="shell">

      <Sidebar />


      <main className="dashboard">

        {/* HEADER */}

        <header>

          <div>

            <p>
              {page === 'overview'
                ? 'MONITORING OVERVIEW'
                : page === 'telemetry'
                ? 'LIVE TELEMETRY'
                : page === 'alerts'
                ? 'ALERTS'
                : 'DEVICES'}
            </p>


            <h1>

              {page === 'overview'
                ? `Good morning, ${
                    user.name.split(' ')[0]
                  }`
                : page === 'telemetry'
                ? 'Live telemetry'
                : page === 'alerts'
                ? 'Inverter alerts'
                : 'Your inverter devices'}

              <span>
                ✦
              </span>

            </h1>


            <small>

              {page === 'overview'
                ? 'Here is your inverter performance at a glance.'
                : page === 'telemetry'
                ? 'Monitor your inverter sensor data in real time.'
                : page === 'alerts'
                ? 'Review fault detection activity.'
                : 'Manage your connected inverter devices.'}

            </small>

          </div>


          {/* DEVICE SELECTOR */}

          <div className="device-picker">

            {devices.length > 0 && (

              <select
                value={
                  activeDevice || ''
                }

                onChange={(e) =>
                  setActiveDevice(
                    Number(
                      e.target.value
                    )
                  )
                }
              >

                {devices.map(
                  (d) => (

                    <option
                      key={d.id}
                      value={d.id}
                    >
                      {d.name}
                    </option>

                  )
                )}

              </select>

            )}


            <button
              onClick={() =>
                setAdding(true)
              }
            >

              <Plus size={18} />

              Add device

            </button>

          </div>

        </header>


        {/* =================================================
            PAGE SWITCHING
        ================================================= */}

        {page === 'overview' && (
          <OverviewPage />
        )}


        {page === 'telemetry' && (
          <TelemetryPage />
        )}


        {page === 'alerts' && (
          <AlertsPage />
        )}


        {page === 'devices' && (
          <DevicesPage />
        )}

      </main>


      {/* =================================================
          ADD DEVICE MODAL
      ================================================= */}

      {adding && (

        <div className="modal">

          <form onSubmit={add}>

            <h2>
              Add inverter
            </h2>


            <input
              name="name"
              placeholder="Inverter name"
              required
            />


            <input
              name="location"
              placeholder="Location"
              required
            />


            <input
              name="capacity"
              type="number"
              step="0.1"
              placeholder="Capacity (kW)"
              required
            />


            <div>

              <button
                type="button"
                className="cancel"
                onClick={() =>
                  setAdding(false)
                }
              >

                Cancel

              </button>


              <button type="submit">

                Add device

              </button>

            </div>

          </form>

        </div>

      )}

    </div>

  );
}


// =====================================================
// APP
// =====================================================

function App() {

  const [user, setUser] =
    useState(null);


  return user ? (

    <Dashboard
      user={user}
      onLogout={() => {

        localStorage.clear();

        setUser(null);

      }}
    />

  ) : (

    <Auth
      onAuth={setUser}
    />

  );

}


// =====================================================
// START REACT APP
// =====================================================

createRoot(
  document.getElementById('root')
).render(
  <App />
);