(function () {
  "use strict";

  var DAILY_GOAL = 10;
  var MSNEXO_WEBSITE_ORIGIN = "https://msnexo.de";

  var PIPELINE_PINS = window.PIPELINE_PINS || { REY: "1111" };
  var COLOR_PALETTE = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
  var USER_COLORS = {};
  Object.keys(PIPELINE_PINS).forEach(function (user, i) {
    USER_COLORS[user] = COLOR_PALETTE[i % COLOR_PALETTE.length];
  });

  function getPipelineUser()   { return sessionStorage.getItem("msnexo_pipeline_user"); }
  function setPipelineUser(u)  { sessionStorage.setItem("msnexo_pipeline_user", u); }
  function clearPipelineUser() { sessionStorage.removeItem("msnexo_pipeline_user"); }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function buildTelLink(phone) {
    var digits = (phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (digits.indexOf("0") === 0) digits = "49" + digits.slice(1);
    return "tel:+" + digits;
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function addDaysISO(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function dateOnly(value) { return value ? value.slice(0, 10) : null; }

  function formatDateTime(iso) {
    if (!iso) return "";
    var d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
    return d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateOnly(iso) {
    if (!iso) return "";
    return new Date(iso.length <= 10 ? iso + "T12:00:00" : iso).toLocaleDateString("de-DE");
  }

  function toDatetimeLocalValue(iso) {
    if (!iso) return "";
    var d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  var statusLabels = { lead: "Lead", contacted: "Kontaktiert", customer: "Kunde", lost: "Kein Interesse" };

  function formatDayLabel(iso) {
    var d = new Date(iso + "T12:00:00");
    var dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    return dayNames[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1) + ".";
  }

  function setReminder(id, name, at) {
    var reminders = JSON.parse(localStorage.getItem("msnexo_reminders") || "[]");
    reminders = reminders.filter(function (r) { return r.id !== id; });
    if (at) reminders.push({ id: id, name: name, at: at });
    localStorage.setItem("msnexo_reminders", JSON.stringify(reminders));
  }

  function hasReminder(id) {
    var reminders = JSON.parse(localStorage.getItem("msnexo_reminders") || "[]");
    return reminders.some(function (r) { return r.id === id; });
  }

  function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var reminders = JSON.parse(localStorage.getItem("msnexo_reminders") || "[]");
    var now = Date.now();
    var remaining = [];
    reminders.forEach(function (r) {
      var diff = new Date(r.at).getTime() - now;
      if (diff >= -60000 && diff < 60000) {
        new Notification("🔔 Erinnerung: " + r.name, { body: "Nächster Kontakt jetzt fällig" });
      } else {
        remaining.push(r);
      }
    });
    localStorage.setItem("msnexo_reminders", JSON.stringify(remaining));
  }

  function startPipeline(client, currentUser) {
    var allLeads = [];
    var currentPeople = [];
    var selectedLeadId = null;
    var showArchive = false;
    var showAll = false;
    var searchQuery = "";

    var dailyCounterEl = document.getElementById("dailyCounter");

    var addLeadBtn = document.getElementById("addLeadBtn");
    var addLeadOverlay = document.getElementById("addLeadOverlay");
    var addLeadClose = document.getElementById("addLeadClose");
    var addLeadForm = document.getElementById("addLeadForm");
    var addLeadStatus = document.getElementById("addLeadStatus");

    var pipelineLeads = document.getElementById("pipelineLeads");
    var pipelineOverdue = document.getElementById("pipelineOverdue");
    var pipelineToday = document.getElementById("pipelineToday");
    var pipelineTomorrow = document.getElementById("pipelineTomorrow");
    var pipelineDates = document.getElementById("pipelineDates");
    var pipelineArchive = document.getElementById("pipelineArchive");
    var toggleArchiveBtn = document.getElementById("toggleArchiveBtn");

    var apptMode = null;
    var apptDate = null;
    var apptBusy = [];
    var apptDaysRow = document.getElementById("apptDaysRow");
    var apptBusyHint = document.getElementById("apptBusyHint");
    var apptTimeInput = document.getElementById("apptTime");
    var apptStatus = document.getElementById("apptStatus");
    var apptBookBtn = document.getElementById("apptBookBtn");
    var apptNameInput = document.getElementById("apptName");
    var apptEmailInput = document.getElementById("apptEmail");
    var apptPhoneInput = document.getElementById("apptPhone");

    var detailOverlay = document.getElementById("leadDetailOverlay");
    var detailClose = document.getElementById("leadDetailClose");
    var detailStatus = document.getElementById("leadDetailStatus");
    var statusSelect = document.getElementById("leadStatusSelect");
    var detailNameInput = document.getElementById("leadDetailNameInput");
    var detailCategoryInput = document.getElementById("leadDetailCategoryInput");
    var detailNotes = document.getElementById("leadDetailNotes");
    var saveNotesBtn = document.getElementById("leadDetailSaveNotes");
    var peopleListEl = document.getElementById("leadDetailPeople");
    var newPersonName = document.getElementById("newPersonName");
    var newPersonPhone = document.getElementById("newPersonPhone");
    var newPersonEmail = document.getElementById("newPersonEmail");
    var addPersonBtn = document.getElementById("addPersonBtn");
    var detailWebsite = document.getElementById("leadDetailWebsite");
    var detailWebsiteOpen = document.getElementById("leadDetailWebsiteOpen");
    var detailAddress = document.getElementById("leadDetailAddress");
    var nextContactDate = document.getElementById("nextContactDate");
    var nextContactNotes = document.getElementById("nextContactNotes");
    var logContactBtn = document.getElementById("logContactBtn");
    var logStatus = document.getElementById("logStatus");
    var reminderBellBtn = document.getElementById("reminderBellBtn");
    var reminderStatus = document.getElementById("reminderStatus");
    var historyEl = document.getElementById("leadDetailHistory");
    var markCustomerBtn = document.getElementById("markCustomerBtn");
    var markLostBtn = document.getElementById("markLostBtn");
    var deleteLeadBtn = document.getElementById("deleteLeadBtn");

    function loadDailyCounter() {
      client.from("lead_contacts").select("id", { count: "exact", head: true }).eq("contact_date", todayISO()).then(function (res) {
        dailyCounterEl.textContent = (res.count || 0) + " von " + DAILY_GOAL + " heute kontaktiert";
      });
    }

    function renderLeadCard(p, index, total) {
      var moveBtnStyle = "background:none;border:1px solid var(--color-border);border-radius:6px;cursor:pointer;padding:2px 8px;font-size:0.8rem;color:var(--color-text-soft);";
      var upBtn = index > 0 ? '<button type="button" data-move="up" style="' + moveBtnStyle + '">▲</button>' : "";
      var downBtn = index < total - 1 ? '<button type="button" data-move="down" style="' + moveBtnStyle + '">▼</button>' : "";
      return (
        '<div class="crm-card crm-lead-card" data-lead-id="' + p.id + '">' +
        '<div class="crm-btn-row" style="justify-content:space-between;align-items:center;">' +
        "<div><strong>" + escapeHtml(p.name) + '</strong> <span class="crm-muted">(' + escapeHtml(p.category) + ")</span></div>" +
        '<div style="display:flex;align-items:center;gap:8px;">' + upBtn + downBtn +
        '<span class="crm-status-pill crm-status-pill--' + p.status + '">' + statusLabels[p.status] + "</span>" +
        '<span class="crm-user-chip" style="background:' + (USER_COLORS[p.assigned_to] || "#888") + ';">' + escapeHtml(p.assigned_to || "REY") + "</span></div>" +
        "</div>" +
        (p.next_contact_date ? '<p class="crm-muted" style="margin:6px 0 0;font-size:0.8rem;">Termin: ' + formatDateOnly(p.next_contact_date) + "</p>" : "") +
        (p.notes ? '<p class="crm-muted" style="margin:8px 0 0;font-size:0.85rem;">' + escapeHtml(p.notes.slice(0, 120)) + "</p>" : "") +
        "</div>"
      );
    }

    function moveLead(bucket, id, dir) {
      var idx = bucket.findIndex(function (p) { return p.id === id; });
      var swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || swapIdx < 0 || swapIdx >= bucket.length) return;
      var reordered = bucket.slice();
      var tmp = reordered[idx];
      reordered[idx] = reordered[swapIdx];
      reordered[swapIdx] = tmp;
      Promise.all(reordered.map(function (p, i) {
        return client.from("leads").update({ sort_order: i }).eq("id", p.id);
      })).then(function () { loadLeads(); });
    }

    function wireBucketEvents(container, prospectsForMove) {
      Array.prototype.forEach.call(container.querySelectorAll("[data-lead-id]"), function (card) {
        card.addEventListener("click", function (e) {
          if (e.target.closest("[data-move]")) return;
          openDetail(card.getAttribute("data-lead-id"));
        });
      });
      Array.prototype.forEach.call(container.querySelectorAll("[data-move]"), function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var card = btn.closest("[data-lead-id]");
          moveLead(prospectsForMove, card.getAttribute("data-lead-id"), btn.getAttribute("data-move"));
        });
      });
    }

    function renderBucket(container, title, leads) {
      if (!leads.length) { container.innerHTML = ""; return; }
      container.innerHTML = '<h3 style="margin-bottom:12px;">' + title + " (" + leads.length + ")</h3>" +
        leads.map(function (p, i) { return renderLeadCard(p, i, leads.length); }).join("");
      wireBucketEvents(container, leads);
    }

    function byDate(a, b) { return new Date(a.next_contact_date) - new Date(b.next_contact_date); }
    function byCreated(a, b) { return new Date(b.created_at) - new Date(a.created_at); }

    function renderLaterBuckets(container, leads) {
      if (!leads.length) { container.innerHTML = ""; return; }
      var grouped = {};
      leads.forEach(function (p) {
        var d = dateOnly(p.next_contact_date);
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(p);
      });
      var dates = Object.keys(grouped).sort();
      container.innerHTML = dates.map(function (d) {
        var group = grouped[d];
        return '<div style="margin-bottom:24px;"><h3 style="margin-bottom:12px;">' +
          formatDayLabel(d) + " (" + group.length + ")</h3>" +
          group.map(function (p, i) { return renderLeadCard(p, i, group.length); }).join("") +
          "</div>";
      }).join("");
      Array.prototype.forEach.call(container.querySelectorAll("[data-lead-id]"), function (card) {
        card.addEventListener("click", function (e) {
          if (e.target.closest("[data-move]")) return;
          openDetail(card.getAttribute("data-lead-id"));
        });
      });
      Array.prototype.forEach.call(container.querySelectorAll("[data-move]"), function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var card = btn.closest("[data-lead-id]");
          var pid = card.getAttribute("data-lead-id");
          var pr = leads.filter(function (p) { return p.id === pid; })[0];
          if (!pr) return;
          moveLead(grouped[dateOnly(pr.next_contact_date)], pid, btn.getAttribute("data-move"));
        });
      });
    }

    function renderPipeline() {
      var today = todayISO();
      var tomorrow = addDaysISO(1);
      var q = searchQuery.toLowerCase();
      var visible = allLeads.filter(function (p) {
        if (q && p.name.toLowerCase().indexOf(q) === -1) return false;
        if (!showAll && (p.assigned_to || "REY") !== currentUser) return false;
        return true;
      });
      var active = visible.filter(function (p) { return p.status === "lead" || p.status === "contacted"; });
      var archived = visible.filter(function (p) { return p.status === "customer" || p.status === "lost"; });

      var newLeads = active.filter(function (p) { return !p.next_contact_date; }).sort(byCreated);
      var overdue = active.filter(function (p) { return p.next_contact_date && dateOnly(p.next_contact_date) < today; }).sort(byDate);
      var dueToday = active.filter(function (p) { return dateOnly(p.next_contact_date) === today; }).sort(byDate);
      var dueTomorrow = active.filter(function (p) { return dateOnly(p.next_contact_date) === tomorrow; }).sort(byDate);
      var later = active.filter(function (p) { return p.next_contact_date && dateOnly(p.next_contact_date) > tomorrow; }).sort(byDate);

      renderBucket(pipelineLeads, "Neue Leads", newLeads);
      renderBucket(pipelineOverdue, "Überfällig", overdue);
      renderBucket(pipelineToday, "Heute", dueToday);
      renderBucket(pipelineTomorrow, "Morgen", dueTomorrow);
      renderLaterBuckets(pipelineDates, later);
      renderBucket(pipelineArchive, "Archiv", archived);
    }

    function loadLeads() {
      return client.from("leads").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }).then(function (res) {
        allLeads = res.data || [];
        renderPipeline();
      });
    }

    function renderPeople(people) {
      currentPeople = people;
      if (!people.length) {
        peopleListEl.innerHTML = '<p class="crm-muted">Noch keine Ansprechpartner.</p>';
        return;
      }
      peopleListEl.innerHTML = people.map(function (person) {
        var tel = person.phone ? buildTelLink(person.phone) : "";
        var meta = [person.phone, person.email].filter(Boolean).map(escapeHtml).join(" · ");
        return (
          '<div style="padding:8px 0;border-bottom:1px solid var(--color-border);">' +
          '<div class="crm-btn-row" style="justify-content:space-between;align-items:center;">' +
          "<div><strong>" + escapeHtml(person.name) + "</strong>" + (meta ? ' <span class="crm-muted" style="font-size:0.85rem;">' + meta + "</span>" : "") + "</div>" +
          (tel ? '<a href="' + tel + '" class="crm-btn crm-btn--dark crm-btn--sm">📞 Anrufen</a>' : "") +
          "</div>" +
          (person.email ? '<a href="mailto:' + escapeHtml(person.email) + '" style="font-size:0.8rem;color:var(--color-primary);">' + escapeHtml(person.email) + "</a>" : "") +
          "</div>"
        );
      }).join("");
    }

    function loadPeople(leadId) {
      return client.from("lead_people").select("*").eq("lead_id", leadId).order("created_at", { ascending: true }).then(function (res) {
        renderPeople(res.data || []);
      });
    }

    function renderHistory(contacts) {
      if (!contacts.length) {
        historyEl.innerHTML = '<p class="crm-muted">Noch keine Einträge.</p>';
        return;
      }
      historyEl.innerHTML = contacts.map(function (c) {
        var when = formatDateTime(c.created_at || c.contact_date);
        var nextBlock = c.next_contact_date
          ? '<div style="margin-top:6px;padding:6px 10px;background:var(--color-bg-soft);border-left:3px solid var(--color-primary);border-radius:0 6px 6px 0;font-size:0.83rem;">📅 Nächster Kontakt: <strong>' + formatDateTime(c.next_contact_date) + "</strong></div>"
          : "";
        return (
          '<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--color-border);">' +
          '<span class="crm-muted" style="font-size:0.8rem;">' + when + "</span>" +
          '<p style="margin:4px 0 0;">' + escapeHtml(c.notes || "—") + "</p>" +
          nextBlock +
          "</div>"
        );
      }).join("");
    }

    function loadHistory(leadId) {
      return client.from("lead_contacts").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).then(function (res) {
        renderHistory(res.data || []);
      });
    }

    function refreshDetailStatus() {
      var p = allLeads.filter(function (x) { return x.id === selectedLeadId; })[0];
      if (!p) return;
      detailStatus.className = "crm-status-pill crm-status-pill--" + p.status;
      detailStatus.textContent = statusLabels[p.status];
      statusSelect.value = p.status;
    }

    function openDetail(id) {
      selectedLeadId = id;
      var p = allLeads.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      detailStatus.className = "crm-status-pill crm-status-pill--" + p.status;
      detailStatus.textContent = statusLabels[p.status];
      detailNameInput.value = p.name;
      detailCategoryInput.value = p.category;
      detailWebsite.value = p.website || "";
      detailAddress.value = p.address || "";
      detailWebsiteOpen.href = p.website || "#";
      detailWebsiteOpen.hidden = !p.website;
      detailNotes.value = p.notes || "";
      statusSelect.value = p.status;
      nextContactDate.value = toDatetimeLocalValue(p.next_contact_date);
      nextContactNotes.value = "";
      reminderStatus.textContent = "";
      reminderBellBtn.style.opacity = hasReminder(id) ? "1" : "0.5";
      var xferStatus = document.getElementById("transferStatus");
      if (xferStatus) xferStatus.textContent = "Aktuell: " + (p.assigned_to || "REY");
      detailOverlay.hidden = false;
      resetApptWidget();
      apptNameInput.value = p.name || "";
      loadPeople(id).then(function () {
        var firstPerson = currentPeople[0];
        if (firstPerson) {
          apptEmailInput.value = firstPerson.email || "";
          apptPhoneInput.value = firstPerson.phone || "";
        }
      });
      loadHistory(id);
    }

    // ── Termin fest vereinbaren ─────────────────────────────────────────────
    function nextWeekdaysAppt(count) {
      var dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      var days = [];
      var d = new Date();
      while (days.length < count) {
        var day = d.getDay();
        if (day >= 1 && day <= 5) {
          var iso = d.toISOString().slice(0, 10);
          var label = dayNames[day] + " " + String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ".";
          days.push({ iso: iso, label: label });
        }
        d.setDate(d.getDate() + 1);
      }
      return days;
    }

    function resetApptWidget() {
      apptMode = null;
      apptDate = null;
      apptBusy = [];
      apptStatus.textContent = "";
      apptBusyHint.textContent = "";
      apptTimeInput.value = "";
      Array.prototype.forEach.call(document.querySelectorAll(".appt-mode-btn"), function (btn) {
        btn.style.background = "var(--color-bg-soft, #eaf2fc)";
        btn.style.color = "var(--color-text, #0b0b0b)";
      });
      renderApptDays();
    }

    function renderApptDays() {
      var days = nextWeekdaysAppt(10);
      apptDaysRow.innerHTML = "";
      days.forEach(function (d) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = d.label;
        btn.className = "crm-btn crm-btn--sm";
        btn.style.flexShrink = "0";
        btn.style.background = "var(--color-bg-soft, #eaf2fc)";
        btn.style.color = "var(--color-text, #0b0b0b)";
        btn.addEventListener("click", function () {
          apptDate = d.iso;
          apptTimeInput.value = "";
          Array.prototype.forEach.call(apptDaysRow.children, function (b) {
            b.style.background = "var(--color-bg-soft, #eaf2fc)";
            b.style.color = "var(--color-text, #0b0b0b)";
          });
          btn.style.background = "var(--color-primary, #2a78d6)";
          btn.style.color = "#fff";
          loadApptBusy(d.iso);
        });
        apptDaysRow.appendChild(btn);
      });
    }

    function loadApptBusy(dateIso) {
      apptBusyHint.textContent = "Belegte Zeiten werden geladen …";
      fetch(MSNEXO_WEBSITE_ORIGIN + "/api/appointments/availability?date=" + dateIso)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          apptBusy = data.busy || [];
          if (!apptBusy.length) {
            apptBusyHint.textContent = "Der ganze Tag ist frei (9-19 Uhr).";
            return;
          }
          apptBusyHint.textContent = "Bereits belegt: " + apptBusy.map(function (b) {
            return b.start + "–" + b.end;
          }).join(", ");
        })
        .catch(function () {
          apptBusy = [];
          apptBusyHint.textContent = "Verfügbarkeit konnte nicht geladen werden.";
        });
    }

    Array.prototype.forEach.call(document.querySelectorAll(".appt-mode-btn"), function (btn) {
      btn.addEventListener("click", function () {
        apptMode = btn.getAttribute("data-mode");
        Array.prototype.forEach.call(document.querySelectorAll(".appt-mode-btn"), function (b) {
          b.style.background = "var(--color-bg-soft, #eaf2fc)";
          b.style.color = "var(--color-text, #0b0b0b)";
        });
        btn.style.background = "var(--color-primary, #2a78d6)";
        btn.style.color = "#fff";
      });
    });

    function timeToMinutes(hhmm) {
      var parts = hhmm.split(":");
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    apptBookBtn.addEventListener("click", function () {
      if (!selectedLeadId) return;
      var time = apptTimeInput.value;
      if (!apptMode || !apptDate || !time) {
        apptStatus.textContent = "Bitte Art, Tag und Uhrzeit auswählen.";
        return;
      }
      var startMin = timeToMinutes(time);
      var endMin = startMin + 60;
      if (startMin < 9 * 60 || endMin > 19 * 60) {
        apptStatus.textContent = "Bitte eine Startzeit zwischen 09:00 und 18:00 wählen.";
        return;
      }
      var overlapsBusy = apptBusy.some(function (b) {
        var bs = timeToMinutes(b.start);
        var be = timeToMinutes(b.end);
        return startMin < be && bs < endMin;
      });
      if (overlapsBusy) {
        apptStatus.textContent = "Diese Zeit überschneidet sich mit einem bereits belegten Termin.";
        return;
      }
      var name = apptNameInput.value.trim();
      var email = apptEmailInput.value.trim();
      if (!name || !email) {
        apptStatus.textContent = "Bitte Name und E-Mail des Kunden angeben.";
        return;
      }
      apptStatus.textContent = "Wird gebucht …";
      fetch(MSNEXO_WEBSITE_ORIGIN + "/api/appointments/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: apptPhoneInput.value.trim(),
          mode: apptMode,
          date: apptDate,
          time: time,
          leadId: selectedLeadId,
          createdBy: "admin"
        })
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            apptStatus.textContent = result.data.error === "slot_taken"
              ? "Dieser Termin wurde gerade vergeben. Bitte andere Zeit wählen."
              : "Buchung fehlgeschlagen. Bitte erneut versuchen.";
            if (result.data.error === "slot_taken") loadApptBusy(apptDate);
            return;
          }
          if (result.data.meetLink) {
            apptStatus.innerHTML = "Termin gebucht ✓ Meet-Link (in Zwischenablage kopiert): " +
              '<a href="' + result.data.meetLink + '" target="_blank" rel="noopener">' + result.data.meetLink + "</a>";
            navigator.clipboard.writeText(result.data.meetLink).catch(function () {});
          } else {
            apptStatus.textContent = "Termin gebucht ✓";
          }
          loadHistory(selectedLeadId);
        })
        .catch(function () {
          apptStatus.textContent = "Buchung fehlgeschlagen. Bitte erneut versuchen.";
        });
    });

    addLeadBtn.addEventListener("click", function () { addLeadOverlay.hidden = false; });
    addLeadClose.addEventListener("click", function () { addLeadOverlay.hidden = true; });
    detailClose.addEventListener("click", function () {
      detailOverlay.hidden = true;
      selectedLeadId = null;
    });

    detailWebsite.addEventListener("input", function () {
      detailWebsiteOpen.href = detailWebsite.value || "#";
      detailWebsiteOpen.hidden = !detailWebsite.value;
    });

    toggleArchiveBtn.addEventListener("click", function () {
      showArchive = !showArchive;
      pipelineArchive.hidden = !showArchive;
      toggleArchiveBtn.textContent = showArchive ? "Archiv ausblenden" : "Archiv anzeigen";
    });

    var pipelineSearchEl = document.getElementById("pipelineSearch");
    if (pipelineSearchEl) {
      pipelineSearchEl.addEventListener("input", function () {
        searchQuery = pipelineSearchEl.value.trim();
        renderPipeline();
      });
    }

    var toggleViewBtn = document.getElementById("toggleViewBtn");
    if (toggleViewBtn) {
      toggleViewBtn.addEventListener("click", function () {
        showAll = !showAll;
        toggleViewBtn.textContent = showAll ? "Meine anzeigen" : "Alle anzeigen";
        renderPipeline();
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll(".transfer-btn"), function (btn) {
      btn.style.background = USER_COLORS[btn.getAttribute("data-target")] || "#888";
      btn.style.borderColor = btn.style.background;
      btn.style.color = "#fff";
      btn.addEventListener("click", function () {
        if (!selectedLeadId) return;
        var target = btn.getAttribute("data-target");
        client.from("leads").update({ assigned_to: target }).eq("id", selectedLeadId).then(function () {
          var ts = document.getElementById("transferStatus");
          if (ts) ts.textContent = "Übergeben an " + target + " ✓";
          loadLeads();
        });
      });
    });

    var logoutPipelineBtn = document.getElementById("logoutPipelineBtn");
    if (logoutPipelineBtn) {
      logoutPipelineBtn.addEventListener("click", function () {
        clearPipelineUser();
        window.location.reload();
      });
    }

    var presentBtn = document.getElementById("presentBtn");
    if (presentBtn) {
      presentBtn.addEventListener("click", function () {
        var presenterLink = MSNEXO_WEBSITE_ORIGIN + "/?presenter=" + encodeURIComponent(window.PRESENTER_SECRET || "");
        var viewerLink = MSNEXO_WEBSITE_ORIGIN + "/?viewer=1";
        window.open(presenterLink, "_blank");
        navigator.clipboard.writeText(viewerLink).then(function () {
          window.alert("Presenter-Ansicht wurde geöffnet.\n\nViewer-Link wurde kopiert – an den Kunden senden:\n" + viewerLink);
        }).catch(function () {
          window.alert("Presenter-Ansicht wurde geöffnet.\n\nViewer-Link für den Kunden:\n" + viewerLink);
        });
      });
    }

    addLeadForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("leadName").value.trim();
      var category = document.getElementById("leadCategory").value.trim() || "Website";
      var status = document.getElementById("leadStatus").value;
      var website = document.getElementById("leadWebsite").value.trim() || null;
      var address = document.getElementById("leadAddress").value.trim() || null;
      var person = {
        name: document.getElementById("leadPersonName").value.trim(),
        phone: document.getElementById("leadPersonPhone").value.trim(),
        email: document.getElementById("leadPersonEmail").value.trim()
      };
      if (!name) return;
      addLeadStatus.textContent = "Wird angelegt …";
      addLeadStatus.className = "crm-form-status";
      client.from("leads").insert({ name: name, category: category, status: status, website: website, address: address, assigned_to: currentUser }).select().single().then(function (res) {
        if (res.error) throw res.error;
        var lead = res.data;
        if (person.name) {
          return client.from("lead_people").insert({ lead_id: lead.id, name: person.name, phone: person.phone || null, email: person.email || null });
        }
        return lead;
      }).then(function () {
        addLeadStatus.textContent = "Angelegt.";
        addLeadStatus.className = "crm-form-status crm-form-status--ok";
        addLeadForm.reset();
        addLeadOverlay.hidden = true;
        loadLeads();
      }).catch(function () {
        addLeadStatus.textContent = "Anlegen fehlgeschlagen. Bitte erneut versuchen.";
        addLeadStatus.className = "crm-form-status crm-form-status--error";
      });
    });

    saveNotesBtn.addEventListener("click", function () {
      if (!selectedLeadId) return;
      var nameVal = detailNameInput.value.trim();
      if (!nameVal) return;
      client.from("leads").update({
        name: nameVal,
        category: detailCategoryInput.value.trim() || "Website",
        notes: detailNotes.value.trim(),
        website: detailWebsite.value.trim() || null,
        address: detailAddress.value.trim() || null
      }).eq("id", selectedLeadId).then(function () {
        loadLeads();
      });
    });

    statusSelect.addEventListener("change", function () {
      if (!selectedLeadId) return;
      client.from("leads").update({ status: statusSelect.value }).eq("id", selectedLeadId).then(function () {
        refreshDetailStatus();
        loadLeads();
      });
    });

    reminderBellBtn.addEventListener("click", function () {
      if (!selectedLeadId) return;
      var at = nextContactDate.value;
      if (!at) { reminderStatus.textContent = "Bitte zuerst ein Datum eingeben."; return; }
      var p = allLeads.filter(function (x) { return x.id === selectedLeadId; })[0];
      var name = p ? p.name : "";
      if (hasReminder(selectedLeadId)) {
        setReminder(selectedLeadId, name, null);
        reminderStatus.textContent = "Erinnerung entfernt.";
        reminderBellBtn.style.opacity = "0.5";
      } else {
        setReminder(selectedLeadId, name, at);
        reminderStatus.textContent = "Erinnerung gesetzt ✓ (" + new Date(at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) + ")";
        reminderBellBtn.style.opacity = "1";
      }
    });

    addPersonBtn.addEventListener("click", function () {
      var name = newPersonName.value.trim();
      if (!name || !selectedLeadId) return;
      client.from("lead_people").insert({
        lead_id: selectedLeadId,
        name: name,
        phone: newPersonPhone.value.trim() || null,
        email: newPersonEmail.value.trim() || null
      }).then(function () {
        newPersonName.value = "";
        newPersonPhone.value = "";
        newPersonEmail.value = "";
        loadPeople(selectedLeadId);
      });
    });

    logContactBtn.addEventListener("click", function () {
      if (!selectedLeadId) return;
      var date = nextContactDate.value;
      var dateUTC = date ? new Date(date).toISOString() : null;
      var datePart = date ? date.slice(0, 10) : null;
      var notes = nextContactNotes.value.trim();
      var leadId = selectedLeadId;
      logStatus.textContent = "Wird gespeichert …";
      logStatus.className = "crm-form-status";
      client.from("lead_contacts").insert({
        lead_id: leadId,
        contact_date: todayISO(),
        notes: notes || null,
        next_contact_date: dateUTC
      }).then(function (res) {
        if (res && res.error) throw res.error;
        var p = allLeads.filter(function (x) { return x.id === leadId; })[0];
        var updates = { next_contact_date: datePart };
        if (p && p.status === "lead") updates.status = "contacted";
        return client.from("leads").update(updates).eq("id", leadId);
      }).then(function () {
        nextContactNotes.value = "";
        nextContactDate.value = "";
        logStatus.textContent = "Gespeichert ✓";
        logStatus.className = "crm-form-status crm-form-status--ok";
        loadDailyCounter();
        loadHistory(leadId);
        return loadLeads();
      }).then(function () {
        refreshDetailStatus();
      }).catch(function (err) {
        logStatus.textContent = "Fehler: " + (err && err.message ? err.message : "Speichern fehlgeschlagen");
        logStatus.className = "crm-form-status crm-form-status--error";
      });
    });

    markLostBtn.addEventListener("click", function () {
      if (!selectedLeadId) return;
      if (!window.confirm("Diesen Lead als 'Kein Interesse' markieren? Er kommt ins Archiv.")) return;
      client.from("leads").update({ status: "lost" }).eq("id", selectedLeadId).then(function () {
        detailOverlay.hidden = true;
        loadLeads();
      });
    });

    deleteLeadBtn.addEventListener("click", function () {
      if (!selectedLeadId) return;
      var p = allLeads.filter(function (x) { return x.id === selectedLeadId; })[0];
      if (!p) return;
      if (!window.confirm('"' + p.name + '" komplett löschen? Das kann nicht rückgängig gemacht werden.')) return;
      client.from("leads").delete().eq("id", selectedLeadId).then(function () {
        detailOverlay.hidden = true;
        selectedLeadId = null;
        loadLeads();
      });
    });

    markCustomerBtn.addEventListener("click", function () {
      if (!selectedLeadId) return;
      var p = allLeads.filter(function (x) { return x.id === selectedLeadId; })[0];
      if (!p) return;
      if (!window.confirm('"' + p.name + '" als Kunde anlegen?')) return;
      var firstPerson = currentPeople[0] || {};
      client.from("clients").insert({
        company_name: p.name,
        contact_person: firstPerson.name || "",
        phone: firstPerson.phone || "",
        email: firstPerson.email || "",
        notes: p.notes || ""
      }).select().single().then(function (res) {
        if (res.error) throw res.error;
        var clientRow = res.data;
        return client.from("leads").update({ status: "customer", client_id: clientRow.id }).eq("id", selectedLeadId);
      }).then(function () {
        refreshDetailStatus();
        loadLeads();
      }).catch(function () {
        window.alert("Anlegen fehlgeschlagen. Bitte erneut versuchen.");
      });
    });

    var notifiedThisSession = false;
    function checkDueNotifications() {
      if (notifiedThisSession) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      var today = todayISO();
      var due = allLeads.filter(function (p) {
        return p.next_contact_date && dateOnly(p.next_contact_date) <= today && (p.status === "lead" || p.status === "contacted");
      });
      if (due.length > 0) {
        notifiedThisSession = true;
        new Notification("msnexo Vertrieb – " + due.length + " fällig", {
          body: due.slice(0, 3).map(function (p) { return p.name; }).join(", ") + (due.length > 3 ? " ..." : "")
        });
      }
    }

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    setInterval(checkReminders, 60000);

    loadDailyCounter();
    loadLeads().then(function () { checkDueNotifications(); });
  } // end startPipeline

  // ── Pipeline-Authentifizierung & Boot ─────────────────────────────────
  (function () {
    var loginOverlay = document.getElementById("pipelineLoginOverlay");
    var pinEntry     = document.getElementById("pipelinePinEntry");
    var pinLabel     = document.getElementById("pipelinePinLabel");
    var pinInput     = document.getElementById("pipelinePinInput");
    var pinConfirm   = document.getElementById("pipelinePinConfirm");
    var pinError     = document.getElementById("pipelinePinError");
    var userBadge    = document.getElementById("pipelineUserBadge");
    var pendingUser  = null;

    function bootWithUser(user) {
      if (userBadge) {
        userBadge.textContent = user;
        userBadge.style.background = USER_COLORS[user] || "#888";
      }
      // Supabase-Admin-Session erforderlich (schreibt RLS via is_admin())
      window.mkCRM.requireAdminSession(function (session, client) {
        startPipeline(client, user);
      });
    }

    var stored = getPipelineUser();
    if (stored && PIPELINE_PINS[stored]) {
      bootWithUser(stored);
      return;
    }

    if (loginOverlay) loginOverlay.hidden = false;

    Array.prototype.forEach.call(document.querySelectorAll(".pipeline-user-btn"), function (btn) {
      btn.style.background = USER_COLORS[btn.getAttribute("data-user")] || "#888";
      btn.style.borderColor = btn.style.background;
      btn.addEventListener("click", function () {
        pendingUser = btn.getAttribute("data-user");
        if (pinLabel) pinLabel.textContent = "PIN für " + pendingUser + ":";
        if (pinEntry) pinEntry.style.display = "";
        if (pinInput) { pinInput.value = ""; pinInput.focus(); }
        if (pinError) pinError.textContent = "";
      });
    });

    function tryLogin() {
      if (!pendingUser) return;
      var entered = pinInput ? pinInput.value.trim() : "";
      if (entered === PIPELINE_PINS[pendingUser]) {
        setPipelineUser(pendingUser);
        if (loginOverlay) loginOverlay.hidden = true;
        bootWithUser(pendingUser);
      } else {
        if (pinError) pinError.textContent = "Falscher PIN. Bitte erneut versuchen.";
        if (pinInput) pinInput.value = "";
      }
    }

    if (pinConfirm) pinConfirm.addEventListener("click", tryLogin);
    if (pinInput) pinInput.addEventListener("keydown", function (e) { if (e.key === "Enter") tryLogin(); });
  })();
})();
