#!/usr/bin/env python3
"""
EngHub - Тестирование прав доступа и функционала системы
"""

import json
import sys
from typing import Dict, List, Optional, Any
from datetime import datetime

# Конфигурация
SUPABASE_URL = "https://inachjylaqelysiwtsux.supabase.co"
SUPABASE_KEY = None  # Будет загружен из файла
USERS_FILE = "/tmp/supabase_key.txt"
TOKENS_DIR = "/tmp/tokens"

# Цвета для вывода
class Colors:
    OK = '\033[92m'      # Зеленый
    FAIL = '\033[91m'    # Красный
    WARN = '\033[93m'    # Желтый
    INFO = '\033[94m'     # Синий
    BOLD = '\033[1m'      # Жирный
    END = '\033[0m'       # Конец

def print_success(msg: str):
    print(f"{Colors.OK}✓ {msg}{Colors.END}")

def print_error(msg: str):
    print(f"{Colors.FAIL}✗ {msg}{Colors.END}")

def print_warning(msg: str):
    print(f"{Colors.WARN}⚠ {msg}{Colors.END}")

def print_info(msg: str):
    print(f"{Colors.INFO}ℹ {msg}{Colors.END}")

def print_bold(msg: str):
    print(f"{Colors.BOLD}{msg}{Colors.END}")

class SupabaseClient:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def request(self, method: str, path: str, token: str = None, data: Dict = None) -> Dict:
        """Выполняет запрос к Supabase"""
        import urllib.request
        import urllib.error

        url = f"{SUPABASE_URL}{path}"

        headers = {
            "apikey": self.api_key,
            "Content-Type": "application/json"
        }

        if token:
            headers["Authorization"] = f"Bearer {token}"

        req_body = None
        if data:
            req_body = json.dumps(data).encode('utf-8')

        req = urllib.request.Request(url, data=req_body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                body = response.read().decode('utf-8')
                if body:
                    return json.loads(body)
                return {}
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8') if e.readable() else "{}"
            error_msg = f"HTTP {e.code}"
            try:
                error_data = json.loads(body)
                if "message" in error_data:
                    error_msg += f": {error_data['message']}"
            except:
                pass
            return {"error": error_msg}
        except Exception as e:
            return {"error": str(e)}

    def get(self, path: str, token: str) -> Dict:
        return self.request("GET", path, token)

    def post(self, path: str, token: str, data: Dict) -> Dict:
        return self.request("POST", path, token, data)

    def patch(self, path: str, token: str, data: Dict) -> Dict:
        return self.request("PATCH", path, token, data)

    def delete(self, path: str, token: str) -> Dict:
        return self.request("DELETE", path, token)

def load_tokens(tokens_dir: str) -> Dict[str, str]:
    """Загружает токены из файлов"""
    tokens = {}
    import os

    roles = ['admin', 'gip', 'lead', 'engineer', 'lead_engineer', 'observer']

    for role in roles:
        token_file = f"{tokens_dir}/token_{role}.txt"
        try:
            with open(token_file, 'r') as f:
                tokens[role] = f.read().strip()
        except FileNotFoundError:
            print_warning(f"Токен для роли {role} не найден")

    return tokens

def get_user_info(client: SupabaseClient, token: str) -> Dict:
    """Получает информацию о пользователе"""
    response = client.get("/auth/v1/user", token)

    if "error" in response:
        return {"error": response["error"]}

    return response

def test_read_projects(client: SupabaseClient, token: str, role: str) -> Dict:
    """Тестирует чтение проектов"""
    response = client.get("/rest/v1/projects?select=id,name,gip_id,status,depts", token)

    if "error" in response:
        return {
            "status": "error",
            "message": response["error"],
            "count": 0,
            "projects": []
        }

    projects = response if isinstance(response, list) else []

    # Группируем по ГИП
    gip_projects = {}
    for p in projects:
        gip_id = p.get('gip_id', '?')
        if gip_id not in gip_projects:
            gip_projects[gip_id] = []
        gip_projects[gip_id].append(p.get('name', 'N/A'))

    return {
        "status": "success",
        "count": len(projects),
        "projects": projects,
        "gip_projects": gip_projects
    }

def test_create_project(client: SupabaseClient, token: str, role: str) -> Dict:
    """Тестирует создание проекта"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    project_data = {
        "name": f"Test Project {role} {timestamp}",
        "code": f"TEST-{role.upper()}-{timestamp}",
        "status": "active",
        "gip_id": 4  # ГИП1 для теста
    }

    response = client.post("/rest/v1/projects", token, project_data)

    if "error" in response:
        return {
            "status": "error",
            "message": response["error"],
            "project_id": None
        }

    # Получаем ID созданного проекта
    project_id = response.get("id") if isinstance(response, dict) else None

    return {
        "status": "success",
        "message": "Проект создан",
        "project_id": project_id,
        "project": response
    }

def test_update_project(client: SupabaseClient, token: str, role: str, project_id: int) -> Dict:
    """Тестирует обновление проекта"""
    update_data = {
        "name": f"Updated {datetime.now().strftime('%H:%M:%S')}"
    }

    response = client.patch(f"/rest/v1/projects?id=eq.{project_id}", token, update_data)

    if "error" in response:
        return {
            "status": "error",
            "message": response["error"]
        }

    return {
        "status": "success",
        "message": "Проект обновлен"
    }

def test_delete_project(client: SupabaseClient, token: str, role: str, project_id: int) -> Dict:
    """Тестирует удаление проекта"""
    response = client.delete(f"/rest/v1/projects?id=eq.{project_id}", token)

    if "error" in response:
        return {
            "status": "error",
            "message": response["error"]
        }

    return {
        "status": "success",
        "message": "Проект удален"
    }

def test_read_users(client: SupabaseClient, token: str, role: str) -> Dict:
    """Тестирует чтение пользователей"""
    response = client.get("/rest/v1/app_users?select=id,full_name,role,dept_id", token)

    if "error" in response:
        return {
            "status": "error",
            "message": response["error"],
            "count": 0,
            "users": []
        }

    users = response if isinstance(response, list) else []

    return {
        "status": "success",
        "count": len(users),
        "users": users
    }

def test_read_departments(client: SupabaseClient, token: str, role: str) -> Dict:
    """Тестирует чтение отделов"""
    response = client.get("/rest/v1/departments?select=*", token)

    if "error" in response:
        return {
            "status": "error",
            "message": response["error"],
            "count": 0,
            "departments": []
        }

    departments = response if isinstance(response, list) else []

    return {
        "status": "success",
        "count": len(departments),
        "departments": departments
    }

def test_read_normative_docs(client: SupabaseClient, token: str, role: str) -> Dict:
    """Тестирует чтение нормативных документов"""
    response = client.get("/rest/v1/normative_docs?select=id,name,status&limit=5", token)

    if "error" in response:
        return {
            "status": "error",
            "message": response["error"],
            "count": 0,
            "documents": []
        }

    docs = response if isinstance(response, list) else []

    return {
        "status": "success",
        "count": len(docs),
        "documents": docs
    }

def check_table_exists(client: SupabaseClient, token: str, table: str) -> bool:
    """Проверяет существует ли таблица"""
    response = client.get(f"/rest/v1/{table}?select=count&limit=1", token)

    if "error" in response:
        error = response.get("error", "")

        # Если ошибка "table does not exist" - таблицы нет
        if "does not exist" in error.lower() or "not found" in error.lower():
            return False

    return True

def run_tests() -> Dict:
    """Запускает все тесты"""
    # Загружаем API ключ
    try:
        with open(USERS_FILE, 'r') as f:
            SUPABASE_KEY = f.read().strip()
    except FileNotFoundError:
        print_error("API ключ не найден")
        sys.exit(1)

    client = SupabaseClient(SUPABASE_KEY)
    tokens = load_tokens(TOKENS_DIR)

    results = {
        "test_run": datetime.now().isoformat(),
        "roles": {}
    }

    # Определяем ожидания для каждой роли
    expectations = {
        "admin": {
            "can_read_projects": True,
            "can_create_projects": True,
            "can_update_projects": True,
            "can_delete_projects": True,
            "can_read_users": True,
            "can_read_normative_docs": True,
            "project_isolation": False  # Admin видит все
        },
        "gip": {
            "can_read_projects": True,
            "can_create_projects": True,
            "can_update_projects": True,
            "can_delete_projects": True,
            "can_read_users": True,
            "can_read_normative_docs": False,  # RLS блокирует
            "project_isolation": True  # Только свои
        },
        "lead": {
            "can_read_projects": True,
            "can_create_projects": False,  # Только ГИП
            "can_update_projects": False,
            "can_delete_projects": False,
            "can_read_users": True,
            "can_read_normative_docs": False,
            "project_isolation": True  # Только назначенные
        },
        "engineer": {
            "can_read_projects": True,
            "can_create_projects": False,  # Только ГИП
            "can_update_projects": False,
            "can_delete_projects": False,
            "can_read_users": True,
            "can_read_normative_docs": False,
            "project_isolation": True  # Только назначенные
        },
        "lead_engineer": {
            "can_read_projects": True,
            "can_create_projects": False,
            "can_update_projects": False,
            "can_delete_projects": False,
            "can_read_users": True,
            "can_read_normative_docs": False,
            "project_isolation": True
        },
        "observer": {
            "can_read_projects": True,
            "can_create_projects": False,
            "can_update_projects": False,
            "can_delete_projects": False,
            "can_read_users": True,
            "can_read_normative_docs": False,
            "project_isolation": True
        }
    }

    # Проверяем какие таблицы существуют
    tables_to_check = [
        "projects",
        "app_users",
        "departments",
        "normative_docs",
        "project_assignments",  # Новая
        "assignments",  # Новая
        "project_documents",  # Новая
        "notifications"  # Новая
    ]

    print_info("=" * 60)
    print_info("ШАГ 1: Проверка таблиц базы данных")
    print_info("=" * 60)

    table_status = {}
    for table in tables_to_check:
        admin_token = tokens.get("admin")
        exists = check_table_exists(client, admin_token, table)

        table_status[table] = exists
        status_symbol = print_success if exists else print_error
        status_symbol(f"{table}: {'Существует' if exists else 'НЕ СУЩЕСТВУЕТ'}")

    print()

    # Тестируем каждую роль
    print_info("=" * 60)
    print_info("ШАГ 2: Тестирование прав доступа по ролям")
    print_info("=" * 60)
    print()

    for role_name, token in tokens.items():
        if not token:
            print_warning(f"Пропускаем {role_name} - нет токена")
            continue

        print_bold(f"\n🎭 Роль: {role_name.upper()}")
        print("-" * 60)

        role_expectations = expectations.get(role_name, {})

        # Получаем информацию о пользователе
        user_info = get_user_info(client, token)
        if "error" not in user_info:
            print_info(f"Email: {user_info.get('email', 'N/A')}")
            print_info(f"User ID: {user_info.get('id', 'N/A')}")

        results["roles"][role_name] = {
            "user_info": user_info,
            "tests": {}
        }

        # Тест 1: Чтение проектов
        print("\n📁 Чтение проектов:")
        projects_test = test_read_projects(client, token, role_name)
        results["roles"][role_name]["tests"]["read_projects"] = projects_test

        if projects_test["status"] == "success":
            print_success(f"Видит {projects_test['count']} проектов")
            print_info(f"   ГИПы: {list(projects_test['gip_projects'].keys())}")

            for gip_id, proj_names in projects_test['gip_projects'].items():
                print_info(f"   ГИП {gip_id}: {len(proj_names)} проектов")
                for name in proj_names[:3]:  # Первые 3
                    print_info(f"      - {name}")

        else:
            print_error(projects_test["message"])

        # Тест 2: Создание проекта
        print("\n➕ Создание проекта:")
        create_test = test_create_project(client, token, role_name)
        results["roles"][role_name]["tests"]["create_project"] = create_test

        if create_test["status"] == "success":
            print_success(create_test["message"])
            print_info(f"   ID: {create_test['project_id']}")

            # Если проект создан, пробуем обновить и удалить
            test_project_id = create_test["project_id"]

            if test_project_id:
                # Тест 3: Обновление проекта
                print("\n✏️ Обновление проекта:")
                update_test = test_update_project(client, token, role_name, test_project_id)
                results["roles"][role_name]["tests"]["update_project"] = update_test

                if update_test["status"] == "success":
                    print_success(update_test["message"])
                else:
                    print_error(update_test["message"])

                # Тест 4: Удаление проекта
                print("\n🗑️ Удаление проекта:")
                delete_test = test_delete_project(client, token, role_name, test_project_id)
                results["roles"][role_name]["tests"]["delete_project"] = delete_test

                if delete_test["status"] == "success":
                    print_success(delete_test["message"])
                else:
                    print_error(delete_test["message"])

        else:
            print_error(create_test["message"])

        # Тест 5: Чтение пользователей
        print("\n👥 Чтение пользователей:")
        users_test = test_read_users(client, token, role_name)
        results["roles"][role_name]["tests"]["read_users"] = users_test

        if users_test["status"] == "success":
            print_success(f"Видит {users_test['count']} пользователей")
        else:
            print_error(users_test["message"])

        # Тест 6: Чтение отделов
        print("\n🏢 Чтение отделов:")
        depts_test = test_read_departments(client, token, role_name)
        results["roles"][role_name]["tests"]["read_departments"] = depts_test

        if depts_test["status"] == "success":
            print_success(f"Видит {depts_test['count']} отделов")
        else:
            print_error(depts_test["message"])

        # Тест 7: Чтение нормативных документов
        print("\n📄 Чтение нормативных документов:")
        docs_test = test_read_normative_docs(client, token, role_name)
        results["roles"][role_name]["tests"]["read_normative_docs"] = docs_test

        if docs_test["status"] == "success":
            print_success(f"Видит {docs_test['count']} документов")
            for doc in docs_test['documents'][:3]:
                status = doc.get('status', 'N/A')
                name = doc.get('name', 'N/A')[:50]
                print_info(f"   [{status}] {name}")
        else:
            print_error(docs_test["message"])

    # Формируем резюме
    print("\n" + "=" * 60)
    print_bold("РЕЗЮМЕ ИСПЫТАНИЙ")
    print("=" * 60)

    results["summary"] = {
        "tables": table_status,
        "issues": [],
        "recommendations": []
    }

    # Проверяем таблицы
    missing_tables = [t for t, exists in table_status.items() if not exists]
    if missing_tables:
        results["summary"]["issues"].append({
            "severity": "high",
            "category": "database",
            "message": "Отсутствуют таблицы для функционала",
            "details": missing_tables
        })
        results["summary"]["recommendations"].append(
            "Выполните SQL скрипт для создания недостающих таблиц"
        )

    # Проверяем изоляцию проектов
    print("\n🔒 Проверка изоляции проектов:")
    for role_name in ["gip", "lead", "engineer"]:
        if role_name in results["roles"]:
            projects_test = results["roles"][role_name]["tests"].get("read_projects", {})
            if projects_test.get("status") == "success":
                gip_projects = projects_test.get("gip_projects", {})

                # Если видит проекты нескольких ГИПов - проблема изоляции
                if len(gip_projects) > 1:
                    print_error(f"{role_name}: видит проекты {len(gip_projects)} ГИПов - НАРУШЕНИЕ ИЗОЛЯЦИИ!")
                    results["summary"]["issues"].append({
                        "severity": "critical",
                        "category": "rls",
                        "message": f"Роль {role_name} видит проекты разных ГИПов",
                        "details": list(gip_projects.keys())
                    })
                else:
                    print_success(f"{role_name}: видит проекты только одного ГИП - OK")

    # Проверяем права создания проектов
    print("\n🔐 Проверка прав создания проектов:")
    for role_name in ["gip", "lead", "engineer"]:
        if role_name in results["roles"]:
            create_test = results["roles"][role_name]["tests"].get("create_project", {})
            expected = expectations.get(role_name, {}).get("can_create_projects", False)
            actual = create_test.get("status") == "success"

            if actual != expected:
                role_text = "МОЖЕТ" if actual else "НЕ МОЖЕТ"
                expected_text = "должен" if expected else "НЕ должен"
                print_error(f"{role_name}: {role_text} создавать проекты (но {expected_text}) - НАРУШЕНИЕ!")

                severity = "high" if not expected and actual else "medium"
                results["summary"]["issues"].append({
                    "severity": severity,
                    "category": "permissions",
                    "message": f"Неверные права для {role_name}",
                    "details": f"create_project: actual={actual}, expected={expected}"
                })
            else:
                role_text = "может" if expected else "не может"
                print_success(f"{role_name}: {role_text} создавать проекты - OK")

    # Проверяем доступ к нормативным документам
    print("\n📄 Проверка доступа к нормативным документам:")
    for role_name in ["gip", "lead", "engineer"]:
        if role_name in results["roles"]:
            docs_test = results["roles"][role_name]["tests"].get("read_normative_docs", {})
            if docs_test.get("status") == "error":
                print_warning(f"{role_name}: нет доступа (RLS блокирует)")
                results["summary"]["issues"].append({
                    "severity": "medium",
                    "category": "rls",
                    "message": f"Роль {role_name} не имеет доступа к нормативным документам",
                    "details": docs_test.get("message")
                })

    return results

def generate_report(results: Dict, output_file: str):
    """Генерирует детальный отчет"""
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# EngHub - Отчет о тестировании прав доступа\n\n")
        f.write(f"**Дата:** {results['test_run']}\n\n")

        # Таблицы
        f.write("## 📊 Статус таблиц базы данных\n\n")
        f.write("| Таблица | Статус |\n")
        f.write("|---------|--------|\n")
        for table, exists in results["summary"]["tables"].items():
            status = "✅" if exists else "❌"
            f.write(f"| {table} | {status} {'Существует' if exists else 'Отсутствует'} |\n")

        # Проблемы
        f.write("\n## ⚠️ Обнаруженные проблемы\n\n")

        if not results["summary"]["issues"]:
            f.write("✅ Критических проблем не обнаружено\n\n")
        else:
            # Группируем по серьезности
            for severity in ["critical", "high", "medium", "low"]:
                issues = [i for i in results["summary"]["issues"] if i["severity"] == severity]

                if issues:
                    severity_symbol = {
                        "critical": "🔴 КРИТИЧЕСКИЕ",
                        "high": "🟠 ВЫСОКИЕ",
                        "medium": "🟡 СРЕДНИЕ",
                        "low": "🔵 НИЗКИЕ"
                    }

                    f.write(f"### {severity_symbol.get(severity, severity.upper())}\n\n")

                    for i, issue in enumerate(issues, 1):
                        f.write(f"{i}. **{issue['category'].upper()}** - {issue['message']}\n")
                        f.write(f"   - Детали: `{issue.get('details', 'N/A')}`\n\n")

        # Рекомендации
        f.write("## 💡 Рекомендации\n\n")
        for i, rec in enumerate(results["summary"]["recommendations"], 1):
            f.write(f"{i}. {rec}\n")

        # Детали по ролям
        f.write("\n## 👥 Детальные результаты по ролям\n\n")

        for role_name, role_data in results["roles"].items():
            f.write(f"### 🎭 {role_name.upper()}\n\n")

            user_info = role_data.get("user_info", {})
            if "error" not in user_info:
                f.write(f"- **Email:** {user_info.get('email', 'N/A')}\n")
                f.write(f"- **User ID:** {user_info.get('id', 'N/A')}\n")

            f.write("\n**Тесты:**\n\n")

            tests = role_data.get("tests", {})

            # Чтение проектов
            read_projects = tests.get("read_projects", {})
            if read_projects.get("status") == "success":
                f.write(f"- 📁 **Проекты:** {read_projects['count']} шт.\n")
                for gip_id, projects in read_projects.get("gip_projects", {}).items():
                    f.write(f"  - ГИП {gip_id}: {len(projects)} проектов\n")

            # Создание проекта
            create_project = tests.get("create_project", {})
            status_symbol = "✅" if create_project.get("status") == "success" else "❌"
            f.write(f"- ➕ **Создание проекта:** {status_symbol} {create_project.get('message', 'N/A')}\n")

            # Обновление проекта
            update_project = tests.get("update_project", {})
            if update_project:
                status_symbol = "✅" if update_project.get("status") == "success" else "❌"
                f.write(f"- ✏️ **Обновление проекта:** {status_symbol} {update_project.get('message', 'N/A')}\n")

            # Удаление проекта
            delete_project = tests.get("delete_project", {})
            if delete_project:
                status_symbol = "✅" if delete_project.get("status") == "success" else "❌"
                f.write(f"- 🗑️ **Удаление проекта:** {status_symbol} {delete_project.get('message', 'N/A')}\n")

            # Чтение пользователей
            read_users = tests.get("read_users", {})
            if read_users.get("status") == "success":
                f.write(f"- 👥 **Пользователи:** {read_users['count']} чел.\n")

            # Чтение отделов
            read_depts = tests.get("read_departments", {})
            if read_depts.get("status") == "success":
                f.write(f"- 🏢 **Отделы:** {read_depts['count']} шт.\n")

            # Чтение документов
            read_docs = tests.get("read_normative_docs", {})
            if read_docs.get("status") == "success":
                f.write(f"- 📄 **Нормативные документы:** {read_docs['count']} шт.\n")
            elif read_docs.get("error"):
                f.write(f"- 📄 **Нормативные документы:** ❌ Нет доступа\n")

            f.write("\n")

        # Необходимые исправления
        f.write("## 🔧 Необходимые исправления\n\n")

        f.write("### Шаг 1: Создать недостающие таблицы\n\n")
        f.write("Выполните SQL скрипт: `/tmp/enghub-rls-fix.sql`\n\n")

        f.write("### Шаг 2: Исправить RLS политики\n\n")
        f.write("- Настроить изоляцию проектов\n")
        f.write("- Ограничить права создания проектов (только ГИП)\n")
        f.write("- Открыть доступ к нормативным документам для участников\n\n")

        f.write("### Шаг 3: Создать функции и триггеры\n\n")
        f.write("- assign_user_to_project()\n")
        f.write("- create_notification()\n")
        f.write("- Автоматические уведомления\n\n")

if __name__ == "__main__":
    print_bold("EngHub - Тестирование прав доступа и функционала\n")
    print_bold("=" * 60)
    print()

    results = run_tests()

    # Сохраняем результаты
    output_file = "/tmp/enghub-test-report.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print_success(f"\nДетальные результаты сохранены: {output_file}")

    # Генерируем отчет в Markdown
    report_file = "/tmp/enghub-test-report.md"
    generate_report(results, report_file)

    print_success(f"Отчет в формате Markdown: {report_file}")

    # Выводим краткий резюме
    issues = results["summary"]["issues"]
    critical = [i for i in issues if i["severity"] == "critical"]
    high = [i for i in issues if i["severity"] == "high"]
    medium = [i for i in issues if i["severity"] == "medium"]

    print("\n" + "=" * 60)
    print_bold("КРАТКОЕ РЕЗЮМЕ")
    print("=" * 60)

    if critical:
        print_error(f"🔴 Критических проблем: {len(critical)}")
    else:
        print_success(f"🔴 Критических проблем: 0")

    if high:
        print_error(f"🟠 Высоких проблем: {len(high)}")
    else:
        print_success(f"🟠 Высоких проблем: 0")

    if medium:
        print_warning(f"🟡 Средних проблем: {len(medium)}")
    else:
        print_success(f"🟡 Средних проблем: 0")

    if not issues:
        print_success("\n🎉 Отлично! Система работает как ожидалось!")
    else:
        print_warning("\n⚠️ Обнаружены проблемы - см. отчет выше")

    print()
