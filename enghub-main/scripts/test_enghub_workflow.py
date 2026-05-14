#!/usr/bin/env python3
"""
EngHub - Имитация рабочего процесса
ГИП → Начальник отдела → Инженер
"""

import json
import sys
import time
from datetime import datetime, timedelta

try:
    from test_enghub_permissions import (
        SupabaseClient, load_tokens, print_success, print_error,
        print_warning, print_info, print_bold, Colors
    )
except ImportError:
    print_error("Не найден модуль test_enghub_permissions")
    sys.exit(1)

SUPABASE_KEY_FILE = "/tmp/supabase_key.txt"
TOKENS_DIR = "/tmp/tokens"
OUTPUT_FILE = "/tmp/enghub-workflow-test-report.md"

def simulate_workflow():
    """Имитирует рабочий процесс"""

    # Загружаем API ключ
    try:
        with open(SUPABASE_KEY_FILE, 'r') as f:
            SUPABASE_KEY = f.read().strip()
    except FileNotFoundError:
        print_error("API ключ не найден")
        return None

    client = SupabaseClient(SUPABASE_KEY)
    tokens = load_tokens(TOKENS_DIR)

    # Определяем участников
    gip1_token = tokens.get("gip")  # Dmitry Orlov (User ID: 4)
    gip2_token = None  # Попробуем найти токен для второго ГИП

    # Проверяем ID пользователей
    gip1_info = client.get("/auth/v1/user", gip1_token)
    gip1_id = gip1_info.get("id") if "error" not in gip1_info else None

    # lead_token = tokens.get("lead")  # Сидоров Иван (User ID: 2)
    # engineer_token = tokens.get("engineer")  # Иван Петров (User ID: 5)

    workflow_results = {
        "test_run": datetime.now().isoformat(),
        "scenarios": [],
        "issues": [],
        "summary": {}
    }

    report_lines = []
    report_lines.append("# EngHub - Отчет о тестировании рабочего процесса")
    report_lines.append(f"\n**Дата:** {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}\n")
    report_lines.append("## 📋 Сценарии тестирования\n\n")

    # ============================================================================
    # СЦЕНАРИЙ 1: ГИП создает проект
    # ============================================================================
    print("\n" + "=" * 70)
    print_bold("СЦЕНАРИЙ 1: ГИП создает проект")
    print("=" * 70)

    scenario_name = "ГИП создает проект"
    scenario_steps = []
    scenario_passed = True

    # Шаг 1: Создание проекта
    print_info("Шаг 1: ГИП1 создает проект")
    project_code = f"WK-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    project_data = {
        "name": f"Рабочий тест проекта {project_code}",
        "code": project_code,
        "status": "active",
        "gip_id": gip1_id if gip1_id else 4,
        "depts": [3, 6],  # Engineering и QA
        "progress": 0,
        "deadline": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    }

    response = client.post("/rest/v1/projects", gip1_token, project_data)

    if "error" in response:
        print_error(f"Ошибка создания: {response['error']}")
        scenario_passed = False
        scenario_steps.append({
            "step": "Создание проекта",
            "status": "failed",
            "error": response["error"]
        })

        workflow_results["issues"].append({
            "severity": "high",
            "category": "workflow",
            "message": "ГИП не может создать проект",
            "details": response["error"]
        })

        project_id = None
    else:
        print_success("Проект создан успешно")
        project_id = response.get("id")
        print_info(f"   ID проекта: {project_id}")
        print_info(f"   Код: {project_code}")

        scenario_steps.append({
            "step": "Создание проекта",
            "status": "success",
            "project_id": project_id,
            "project_code": project_code
        })

        # Проверяем, что ГИП видит проект
        print_info("Проверка: ГИП1 видит проект")
        projects = client.get(f"/rest/v1/projects?id=eq.{project_id}", gip1_token)

        if "error" not in projects and isinstance(projects, list) and len(projects) > 0:
            print_success("ГИП1 видит созданный проект")
        else:
            print_error("ГИП1 НЕ видит созданный проект!")
            scenario_passed = False

    report_lines.append(f"### {scenario_name}\n")
    report_lines.append(f"**Статус:** {'✅ Пройден' if scenario_passed else '❌ Провален'}\n\n")
    report_lines.append("**Шаги:**\n\n")

    for step in scenario_steps:
        status_symbol = "✅" if step["status"] == "success" else "❌"
        report_lines.append(f"{status_symbol} {step['step']}\n")
        if "error" in step:
            report_lines.append(f"   - Ошибка: `{step['error']}`\n")

    workflow_results["scenarios"].append({
        "name": scenario_name,
        "passed": scenario_passed,
        "steps": scenario_steps
    })

    if project_id:
        # ============================================================================
        # СЦЕНАРИЙ 2: Проверка изоляции (другой ГИП не видит проект)
        # ============================================================================
        print("\n" + "=" * 70)
        print_bold("СЦЕНАРИЙ 2: Изоляция проектов")
        print("=" * 70)

        scenario_name = "Изоляция проектов"
        scenario_steps = []
        scenario_passed = True

        # Попробуем посмотреть проект от лица другого ГИП (если есть)
        # Сейчас используем engineer, чтобы проверить
        engineer_token = tokens.get("engineer")

        if engineer_token:
            print_info("Шаг 1: Проверка видимости проекта инженером")
            projects = client.get(f"/rest/v1/projects?id=eq.{project_id}", engineer_token)

            if "error" not in projects and isinstance(projects, list) and len(projects) > 0:
                print_error("Инженер видит проект ГИП1 - нарушена изоляция!")
                scenario_passed = False
                scenario_steps.append({
                    "step": "Изоляция проекта",
                    "status": "failed",
                    "message": "Инженер не должен видеть проекты в которых не назначен"
                })

                workflow_results["issues"].append({
                    "severity": "critical",
                    "category": "rls",
                    "message": "Нарушена изоляция проектов",
                    "details": "Инженер видит проект, в котором не назначен"
                })
            else:
                print_success("Инженер НЕ видит проект - изоляция работает")
                scenario_steps.append({
                    "step": "Изоляция проекта",
                    "status": "success",
                    "message": "Изоляция работает корректно"
                })

        report_lines.append(f"\n### {scenario_name}\n")
        report_lines.append(f"**Статус:** {'✅ Пройден' if scenario_passed else '❌ Провален'}\n\n")
        report_lines.append("**Шаги:**\n\n")

        for step in scenario_steps:
            status_symbol = "✅" if step["status"] == "success" else "❌"
            report_lines.append(f"{status_symbol} {step['step']}\n")
            if "message" in step:
                report_lines.append(f"   - {step['message']}\n")

        workflow_results["scenarios"].append({
            "name": scenario_name,
            "passed": scenario_passed,
            "steps": scenario_steps
        })

        # ============================================================================
        # СЦЕНАРИЙ 3: Проверка таблицы project_assignments
        # ============================================================================
        print("\n" + "=" * 70)
        print_bold("СЦЕНАРИЙ 3: Проверка назначений (project_assignments)")
        print("=" * 70)

        scenario_name = "Назначения на проект"
        scenario_steps = []
        scenario_passed = True

        # Проверяем существует ли таблица
        print_info("Проверка таблицы project_assignments")
        assignments = client.get(f"/rest/v1/project_assignments?project_id=eq.{project_id}", gip1_token)

        if "error" in assignments:
            print_error(f"Таблица project_assignments недоступна: {assignments['error']}")

            scenario_passed = False
            scenario_steps.append({
                "step": "Проверка таблицы",
                "status": "failed",
                "error": assignments["error"]
            })

            workflow_results["issues"].append({
                "severity": "high",
                "category": "database",
                "message": "Таблица project_assignments не существует или недоступна",
                "details": assignments["error"]
            })

            workflow_results["summary"]["project_assignments_exists"] = False
        else:
            print_success("Таблица project_assignments существует")
            assignment_count = len(assignments) if isinstance(assignments, list) else 0
            print_info(f"   Назначений: {assignment_count}")

            scenario_steps.append({
                "step": "Проверка таблицы",
                "status": "success",
                "assignment_count": assignment_count
            })

            workflow_results["summary"]["project_assignments_exists"] = True
            workflow_results["summary"]["assignment_count"] = assignment_count

        report_lines.append(f"\n### {scenario_name}\n")
        report_lines.append(f"**Статус:** {'✅ Пройден' if scenario_passed else '❌ Провален'}\n\n")
        report_lines.append("**Шаги:**\n\n")

        for step in scenario_steps:
            status_symbol = "✅" if step["status"] == "success" else "❌"
            report_lines.append(f"{status_symbol} {step['step']}\n")
            if "assignment_count" in step:
                report_lines.append(f"   - Назначений: {step['assignment_count']}\n")

        workflow_results["scenarios"].append({
            "name": scenario_name,
            "passed": scenario_passed,
            "steps": scenario_steps
        })

        # ============================================================================
        # СЦЕНАРИЙ 4: Проверка создания заданий
        # ============================================================================
        print("\n" + "=" * 70)
        print_bold("СЦЕНАРИЙ 4: Создание заданий (assignments)")
        print("=" * 70)

        scenario_name = "Создание заданий"
        scenario_steps = []
        scenario_passed = True

        # Проверяем существует ли таблица
        print_info("Проверка таблицы assignments")
        assignments_table = client.get("/rest/v1/assignments?select=count&limit=1", gip1_token)

        if "error" in assignments_table:
            print_error(f"Таблица assignments недоступна: {assignments_table['error']}")

            scenario_passed = False
            scenario_steps.append({
                "step": "Проверка таблицы",
                "status": "failed",
                "error": assignments_table["error"]
            })

            workflow_results["issues"].append({
                "severity": "high",
                "category": "database",
                "message": "Таблица assignments не существует или недоступна",
                "details": assignments_table["error"]
            })

            workflow_results["summary"]["assignments_exists"] = False
        else:
            print_success("Таблица assignments существует")

            # Пробуем создать задание
            print_info("Создание тестового задания")
            task_data = {
                "project_id": project_id,
                "title": "Тестовое задание",
                "description": "Описание тестового задания",
                "assigned_by": gip1_id if gip1_id else 4,
                "assigned_to": 5,  # Инженер
                "status": "assigned",
                "priority": "medium"
            }

            task_response = client.post("/rest/v1/assignments", gip1_token, task_data)

            if "error" in task_response:
                print_error(f"Ошибка создания задания: {task_response['error']}")

                scenario_passed = False
                scenario_steps.append({
                    "step": "Создание задания",
                    "status": "failed",
                    "error": task_response["error"]
                })

                workflow_results["issues"].append({
                    "severity": "medium",
                    "category": "workflow",
                    "message": "Невозможно создать задание",
                    "details": task_response["error"]
                })

                workflow_results["summary"]["can_create_assignment"] = False
            else:
                print_success("Задание создано успешно")
                task_id = task_response.get("id")
                print_info(f"   ID задания: {task_id}")

                scenario_steps.append({
                    "step": "Создание задания",
                    "status": "success",
                    "task_id": task_id
                })

                workflow_results["summary"]["assignments_exists"] = True
                workflow_results["summary"]["can_create_assignment"] = True

        report_lines.append(f"\n### {scenario_name}\n")
        report_lines.append(f"**Статус:** {'✅ Пройден' if scenario_passed else '❌ Провален'}\n\n")
        report_lines.append("**Шаги:**\n\n")

        for step in scenario_steps:
            status_symbol = "✅" if step["status"] == "success" else "❌"
            report_lines.append(f"{status_symbol} {step['step']}\n")
            if "task_id" in step:
                report_lines.append(f"   - ID задания: {step['task_id']}\n")

        workflow_results["scenarios"].append({
            "name": scenario_name,
            "passed": scenario_passed,
            "steps": scenario_steps
        })

        # ============================================================================
        # СЦЕНАРИЙ 5: Проверка уведомлений
        # ============================================================================
        print("\n" + "=" * 70)
        print_bold("СЦЕНАРИЙ 5: Проверка уведомлений")
        print("=" * 70)

        scenario_name = "Система уведомлений"
        scenario_steps = []
        scenario_passed = True

        # Проверяем существует ли таблица
        print_info("Проверка таблицы notifications")
        notifications = client.get("/rest/v1/notifications?select=count&limit=1", gip1_token)

        if "error" in notifications:
            print_error(f"Таблица notifications недоступна: {notifications['error']}")

            scenario_passed = False
            scenario_steps.append({
                "step": "Проверка таблицы",
                "status": "failed",
                "error": notifications["error"]
            })

            workflow_results["issues"].append({
                "severity": "medium",
                "category": "database",
                "message": "Таблица notifications не существует или недоступна",
                "details": notifications["error"]
            })

            workflow_results["summary"]["notifications_exists"] = False
        else:
            print_success("Таблица notifications существует")

            # Проверяем уведомления для пользователя
            print_info("Проверка уведомлений ГИП")
            user_notifications = client.get("/rest/v1/notifications?user_id=eq.4&is_read=eq.false", gip1_token)

            if "error" not in user_notifications:
                notification_count = len(user_notifications) if isinstance(user_notifications, list) else 0
                print_info(f"   Непрочитанных: {notification_count}")

                scenario_steps.append({
                    "step": "Проверка уведомлений",
                    "status": "success",
                    "unread_count": notification_count
                })

                workflow_results["summary"]["notifications_exists"] = True
            else:
                print_warning("Не удалось получить уведомления")

                scenario_steps.append({
                    "step": "Проверка уведомлений",
                    "status": "warning",
                    "message": user_notifications.get("error", "Неизвестная ошибка")
                })

        report_lines.append(f"\n### {scenario_name}\n")
        report_lines.append(f"**Статус:** {'✅ Пройден' if scenario_passed else '❌ Провален'}\n\n")
        report_lines.append("**Шаги:**\n\n")

        for step in scenario_steps:
            status_symbol = "✅" if step["status"] == "success" else "❌"
            if step["status"] == "warning":
                status_symbol = "⚠️"
            report_lines.append(f"{status_symbol} {step['step']}\n")
            if "unread_count" in step:
                report_lines.append(f"   - Непрочитанных: {step['unread_count']}\n")

        workflow_results["scenarios"].append({
            "name": scenario_name,
            "passed": scenario_passed,
            "steps": scenario_steps
        })

    # ============================================================================
    # ИТОГОВЫЙ РЕЗЮМЕ
    # ============================================================================
    print("\n" + "=" * 70)
    print_bold("ИТОГОВОЕ РЕЗЮМЕ")
    print("=" * 70)

    total_scenarios = len(workflow_results["scenarios"])
    passed_scenarios = sum(1 for s in workflow_results["scenarios"] if s["passed"])

    print_info(f"Сценариев выполнено: {passed_scenarios}/{total_scenarios}")

    if passed_scenarios == total_scenarios:
        print_success("🎉 Все сценарии пройдены успешно!")
    else:
        print_error(f"❌ {total_scenarios - passed_scenarios} сценария(ев) провалено")

    # Проблемы
    issues = workflow_results["issues"]
    critical = [i for i in issues if i["severity"] == "critical"]
    high = [i for i in issues if i["severity"] == "high"]
    medium = [i for i in issues if i["severity"] == "medium"]

    print_info(f"\nОбнаружено проблем:")
    print(f"   🔴 Критических: {len(critical)}")
    print(f"   🟠 Высоких: {len(high)}")
    print(f"   🟡 Средних: {len(medium)}")

    # Добавляем резюме в отчет
    report_lines.append("\n## 📊 Итоговое резюме\n\n")
    report_lines.append(f"**Сценариев выполнено:** {passed_scenarios}/{total_scenarios}\n")
    report_lines.append(f"**Статус:** {'✅ Все пройдены' if passed_scenarios == total_scenarios else '❌ Есть проблемы'}\n\n")

    report_lines.append("## ⚠️ Обнаруженные проблемы\n\n")

    if not issues:
        report_lines.append("✅ Проблем не обнаружено\n")
    else:
        for severity in ["critical", "high", "medium"]:
            severity_issues = [i for i in issues if i["severity"] == severity]

            if severity_issues:
                severity_text = {
                    "critical": "🔴 КРИТИЧЕСКИЕ",
                    "high": "🟠 ВЫСОКИЕ",
                    "medium": "🟡 СРЕДНИЕ"
                }

                report_lines.append(f"### {severity_text.get(severity, severity.upper())}\n\n")

                for i, issue in enumerate(severity_issues, 1):
                    report_lines.append(f"{i}. **{issue['category'].upper()}** - {issue['message']}\n")
                    report_lines.append(f"   - Детали: `{issue.get('details', 'N/A')}`\n\n")

    report_lines.append("## 💡 Рекомендации\n\n")

    if not workflow_results["summary"].get("project_assignments_exists", True):
        report_lines.append("1. ⚠️ Таблица `project_assignments` не создана. Выполните SQL скрипт для создания таблиц.\n")

    if not workflow_results["summary"].get("assignments_exists", True):
        report_lines.append("2. ⚠️ Таблица `assignments` не создана. Выполните SQL скрипт для создания таблиц.\n")

    if not workflow_results["summary"].get("notifications_exists", True):
        report_lines.append("3. ⚠️ Таблица `notifications` не создана. Выполните SQL скрипт для создания таблиц.\n")

    if len(critical) > 0:
        report_lines.append(f"4. 🔴 Исправьте {len(critical)} критическую(их) проблему(ы) с изоляцией проектов.\n")

    if len(high) > 0:
        report_lines.append(f"5. 🟠 Исправьте {len(high)} высокую(их) проблему(ы) с созданием объектов.\n")

    # Сохраняем отчет
    report_content = "".join(report_lines)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(report_content)

    print_success(f"\nОтчет сохранен: {OUTPUT_FILE}")

    # Сохраняем результаты в JSON
    json_output = "/tmp/enghub-workflow-results.json"
    with open(json_output, 'w', encoding='utf-8') as f:
        json.dump(workflow_results, f, ensure_ascii=False, indent=2)

    print_success(f"Результаты в JSON: {json_output}")

    return workflow_results

if __name__ == "__main__":
    print_bold("EngHub - Имитация рабочего процесса")
    print_bold("=" * 70)
    print()

    simulate_workflow()
